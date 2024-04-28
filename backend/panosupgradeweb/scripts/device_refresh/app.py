# backend/panosupgradeweb/scripts/inventory_sync/app.py
import os
import sys
import argparse
import json
import logging
import xml.etree.ElementTree as ET

import django
from logstash_async.handler import AsynchronousLogstashHandler

from panos.firewall import Firewall
from panos.panorama import Panorama

# Add the Django project's root directory to the Python path
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
)

# Set the DJANGO_SETTINGS_MODULE environment variable
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_project.settings")

# Initialize the Django application
django.setup()

# import our Django models
from panosupgradeweb.models import Device, DeviceType, Profile  # noqa: E402
from django.core.exceptions import ObjectDoesNotExist  # noqa: E402


# Create a logger instance
logger = logging.getLogger("pan-os-device-refresh")
logger.setLevel(logging.DEBUG)

# Create a Logstash handler
logstash_handler = AsynchronousLogstashHandler(
    # Use the Logstash service name from the Docker Compose file
    host="logstash",
    # The port Logstash is listening on
    port=5000,
    # Disable the local queue database
    database_path=None,
)

# Add the Logstash handler to the logger
logger.addHandler(logstash_handler)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
logger.addHandler(console_handler)


# Create JOB_ID global variable
global JOB_ID
JOB_ID = ""


def get_emoji(action: str) -> str:
    """
    Maps specific action keywords to their corresponding emoji symbols for enhanced log and user interface messages.

    This utility function is designed to add visual cues to log messages or user interface outputs by associating specific action keywords with relevant emoji symbols. It aims to improve the readability and user experience by providing a quick visual reference for the action's nature or outcome. The function supports a predefined set of keywords, each mapping to a unique emoji. If an unrecognized keyword is provided, the function returns an empty string to ensure seamless operation without interrupting the application flow.

    Parameters
    ----------
    action : str
        A keyword representing the action or status for which an emoji is required. Supported keywords include 'success', 'error', 'warning', 'working', 'report', 'search', 'save', 'stop', and 'start'.

    Returns
    -------
    str
        The emoji symbol associated with the specified action keyword. Returns an empty string if the keyword is not recognized, maintaining non-disruptive output.

    Examples
    --------
    Adding visual cues to log messages:
        >>> logging.info(f"{get_emoji(action='success')} Operation successful.")
        >>> logging.error(f"{get_emoji(action='error')} An error occurred.")

    Enhancing user prompts in a command-line application:
        >>> print(f"{get_emoji(action='start')} Initiating the process.")
        >>> print(f"{get_emoji(action='stop')} Process terminated.")

    Notes
    -----
    - The function enhances the aesthetic and functional aspects of textual outputs, making them more engaging and easier to interpret at a glance.
    - It is implemented with a fail-safe approach, where unsupported keywords result in an empty string, thus preserving the integrity and continuity of the output.
    - Customization or extension of the supported action keywords and their corresponding emojis can be achieved by modifying the internal emoji_map dictionary.

    This function is not expected to raise any exceptions, ensuring stable and predictable behavior across various usage contexts.
    """

    emoji_map = {
        "debug": "🐛",
        "error": "❌",
        "info": "ℹ️",
        "report": "📊",
        "save": "💾",
        "search": "🔍",
        "skipped": "⏭️",
        "start": "🚀",
        "stop": "🛑",
        "success": "✅",
        "warning": "⚠️",
        "working": "⏳",
    }
    return emoji_map.get(action, "")


def log_device_refresh(
    level: str,
    message: str,
):
    emoji = get_emoji(action=level.lower())
    message = f"{emoji} {message}"
    extra = {
        "job_id": JOB_ID,
        "job_type": "device_refresh",
    }
    logger.log(getattr(logging, level), message, extra=extra)


def find_devicegroup_by_serial(data, serial):
    for entry in data:
        if "devices" in entry:
            for device in entry["devices"]:
                if device["serial"] == serial:
                    return entry["@name"]
    return None


def flatten_xml_to_dict(element: ET.Element) -> dict:
    result = {}
    for child_element in element:
        child_tag = child_element.tag
        if child_element.text and len(child_element) == 0:
            result[child_tag] = child_element.text
        else:
            if child_tag in result:
                if not isinstance(result.get(child_tag), list):
                    result[child_tag] = [
                        result.get(child_tag),
                        flatten_xml_to_dict(element=child_element),
                    ]
                else:
                    result[child_tag].append(flatten_xml_to_dict(element=child_element))
            else:
                if child_tag == "entry":
                    result[child_tag] = [flatten_xml_to_dict(element=child_element)]
                else:
                    result[child_tag] = flatten_xml_to_dict(element=child_element)

    return result


def get_device_group_mapping(panorama: Panorama):
    device_group_mappings = []
    device_groups = panorama.op("show devicegroups")

    # Iterate over each 'entry' element under 'devicegroups'
    for entry in device_groups.findall(".//devicegroups/entry"):
        entry_dict = {"@name": entry.get("name")}

        # Check if the 'entry' has 'devices' element
        devices_elem = entry.find("devices")
        if devices_elem is not None:
            devices = []

            # Iterate over each 'entry' element under 'devices'
            for device in devices_elem.findall("entry"):
                device_dict = {
                    "@name": device.get("name"),
                    "serial": device.find("serial").text,
                    "connected": device.find("connected").text,
                }
                devices.append(device_dict)

            entry_dict["devices"] = devices

        device_group_mappings.append(entry_dict)

    return device_group_mappings


def run_device_refresh(
    author_id: int,
    device_uuid: str,
    job_id: str,
    profile_uuid: str,
):

    # JOB_ID global variable
    global JOB_ID
    JOB_ID = job_id

    log_device_refresh(
        level="DEBUG",
        message=f"Running device refresh for device: {device_uuid}",
    )
    log_device_refresh(
        level="DEBUG",
        message=f"Using profile: {profile_uuid}",
    )
    log_device_refresh(
        level="DEBUG",
        message=f"Author ID: {author_id}",
    )

    # Initialize an empty dictionary to store the device data
    device_data = {}

    # Retrieve the PAN device, device type, and profile objects from the database
    device = Device.objects.get(uuid=device_uuid)
    profile = Profile.objects.get(uuid=profile_uuid)
    platform = device.platform

    # Build the PAN device object
    try:
        # if the device is not managed by Panorama, then we will connect to it directly
        if platform.device_type == "Firewall" and not device.panorama_managed:
            # Connect to the firewall device using the retrieved credentials
            pan_device = Firewall(
                device.ipv4_address,
                profile.pan_username,
                profile.pan_password,
            )
            log_device_refresh(
                level="INFO",
                message=f"Connected to firewall device {device.ipv4_address}",
            )

        elif platform.device_type == "Firewall" and device.panorama_managed:
            pan_device = Firewall(
                serial=device.serial,
            )
            panorama = Panorama(
                device.panorama_ipv4_address,
                profile.pan_username,
                profile.pan_password,
            )
            panorama.add(pan_device)

            # Retrieve device group
            device_group_mappings = get_device_group_mapping(panorama)
            device_data["device_group"] = find_devicegroup_by_serial(
                device_group_mappings,
                device.serial,
            )
            log_device_refresh(
                level="INFO",
                message=f"Connected to firewall through Panorama device {device.panorama_ipv4_address}",
            )

        else:
            # Connect to the Panorama device using the retrieved credentials
            pan_device = Panorama(
                device.ipv4_address,
                profile.pan_username,
                profile.pan_password,
            )
            log_device_refresh(
                level="INFO",
                message=f"Connected to Panorama device {device.ipv4_address}",
            )

    except Exception as e:
        log_device_refresh(
            level="ERROR",
            message=f"Error while connecting to the PAN device: {str(e)}",
        )
        raise e

    # Connect to the PAN device and retrieve the system information
    try:
        # Retrieve the system information from the firewall device
        system_info = pan_device.show_system_info()
        log_device_refresh(
            level="INFO",
            message=f"Retrieved system information from device {device.ipv4_address}",
        )
        log_device_refresh(
            level="DEBUG",
            message=f"System Info: {system_info}",
        )

        # Store the relevant system information in the device_data dictionary
        device_data["hostname"] = system_info["system"]["hostname"]
        device_data["ipv4_address"] = system_info["system"]["ip-address"]
        device_data["ipv6_address"] = (
            system_info["system"]["ipv6-address"]
            if system_info["system"]["ipv6-address"] != "unknown"
            else None
        )
        device_data["serial"] = system_info["system"]["serial"]
        device_data["sw_version"] = system_info["system"]["sw-version"]
        device_data["app_version"] = (
            system_info["system"]["app-version"]
            if platform.device_type == "Firewall"
            else None
        )
        device_data["threat_version"] = (
            system_info["system"]["threat-version"]
            if platform.device_type == "Firewall"
            else None
        )
        device_data["uptime"] = system_info["system"]["uptime"]
        device_data["platform"] = platform.name

        # Retrieve the HA state information from the firewall device
        ha_info = pan_device.show_highavailability_state()

        # Parse the HA state information and store it in the device_data dictionary
        if platform.device_type == "Firewall" and ha_info[0] != "disabled":
            ha_details = flatten_xml_to_dict(element=ha_info[1])
            local_state = (
                ha_details.get("result", {})
                .get("group", {})
                .get("local-info", {})
                .get("state")
            )
            device_data["ha_enabled"] = True

            peer_ip = (
                ha_details.get("result", {})
                .get("group", {})
                .get("peer-info", {})
                .get("mgmt-ip", "")
                .split("/")[0]
            )

            try:
                peer_device = Device.objects.get(ipv4_address=peer_ip)
                peer_device_uuid = str(peer_device.uuid)
                peer_state = (
                    ha_details.get("result", {})
                    .get("group", {})
                    .get("peer-info", {})
                    .get("state")
                )

                device_data["peer_device_id"] = peer_device_uuid
                device_data["peer_ip"] = peer_ip
                device_data["peer_state"] = peer_state
                device_data["local_state"] = local_state
            except Device.DoesNotExist:
                log_device_refresh(
                    level="WARNING",
                    message=f"Peer device with IP {peer_ip} not found. Skipping HA deployment.",
                )
        else:
            device_data["ha_enabled"] = False

        # Store additional device information in the device_data dictionary
        device_data["panorama_managed"] = device.panorama_managed
        device_data["panorama_appliance"] = (
            str(device.panorama_appliance.uuid) if device.panorama_managed else None
        )
        log_device_refresh(
            level="DEBUG",
            message=f"Device Data: {device_data}",
        )

        # Update the Device object using the device_data dictionary
        Device.objects.filter(uuid=device_uuid).update(
            app_version=device_data["app_version"],
            author_id=author_id,
            device_group=device_data.get("device_group"),
            ha_enabled=device_data["ha_enabled"],
            ipv4_address=device_data["ipv4_address"],
            ipv6_address=device_data["ipv6_address"],
            local_state=device_data.get("local_state"),
            panorama_managed=device_data["panorama_managed"],
            panorama_appliance_id=device_data.get("panorama_appliance"),
            peer_device_id=device_data.get("peer_device_id"),
            peer_ip=device_data.get("peer_ip"),
            peer_state=device_data.get("peer_state"),
            serial=device_data["serial"],
            sw_version=device_data["sw_version"],
            threat_version=device_data["threat_version"],
            uptime=device_data["uptime"],
        )
        log_device_refresh(
            level="INFO",
            message=f"Device {device_data['hostname']} updated successfully",
        )

        # Serialize the device_data dictionary to JSON
        return json.dumps(device_data)

    except Exception as e:
        log_device_refresh(
            level="ERROR",
            message=f"Error while retrieving system information: {str(e)}",
        )
        raise e


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run device refresh script for Palo Alto Networks devices"
    )
    parser.add_argument(
        "-d",
        "--device-uuid",
        type=str,
        required=True,
        help="UUID of the device to refresh from",
    )
    parser.add_argument(
        "-p",
        "--profile-uuid",
        type=str,
        required=True,
        help="UUID of the profile to use for authentication",
    )
    parser.add_argument(
        "-a",
        "--author-id",
        type=int,
        required=True,
        help="ID of the author performing the device refresh",
    )

    args = parser.parse_args()

    device_uuid = args.device_uuid
    profile_uuid = args.profile_uuid
    author_id = args.author_id

    run_device_refresh(
        author_id=author_id,
        device_uuid=device_uuid,
        job_id="CLI",
        profile_uuid=profile_uuid,
    )
