# backend/panosupgradeweb/scripts/inventory_sync/app.py
import os
import sys
import argparse
import json
import logging
import xml.etree.ElementTree as ET

import django

from typing import List, Dict, Optional
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
logger = logging.getLogger("inventory-sync")
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

# Debugging: Add a console handler to the logger
# console_handler = logging.StreamHandler()
# console_handler.setLevel(logging.INFO)
# logger.addHandler(console_handler)

# Create JOB_ID global variable
global JOB_ID
JOB_ID = ""


def find_devicegroup_by_serial(
    data: List[Dict],
    serial: str,
) -> Optional[str]:
    """
    Find the device group name for a given device serial number.

    This function iterates through a list of dictionaries representing device groups and their associated devices.
    It searches for a device with the specified serial number and returns the name of the device group if found.

    Args:
        data (List[Dict]): A list of dictionaries containing device group information and associated devices.
                           Each dictionary should have the following structure:
                           {
                               "@name": "device_group_name",
                               "devices": [
                                   {
                                       "serial": "device_serial_number",
                                       ...
                                   },
                                   ...
                               ],
                               ...
                           }
        serial (str): The serial number of the device to search for.

    Returns:
        Optional[str]: The name of the device group if the device with the specified serial number is found, None otherwise.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Iterate through data}
            B --> C{Device group has "devices" key?}
            C -->|Yes| D{Iterate through devices}
            C -->|No| B
            D --> E{Device serial matches target serial?}
            E -->|Yes| F[Return device group name]
            E -->|No| D
            D --> B
            B --> G{All device groups checked?}
            G -->|Yes| H[Return None]
            G -->|No| B
        ```
    """
    log_inventory_sync(
        action="start",
        message="Starting device group search for serial: {}".format(serial),
    )

    for entry in data:
        log_inventory_sync(
            action="search",
            message="Checking device group: {}".format(entry.get("@name", "Unknown")),
        )

        if "devices" in entry:
            for device in entry["devices"]:
                log_inventory_sync(
                    action="search",
                    message="Checking device: {}".format(
                        device.get("serial", "Unknown"),
                    ),
                )

                if device["serial"] == serial:
                    log_inventory_sync(
                        action="success",
                        message="Found matching device in group: {}".format(
                            entry["@name"]
                        ),
                    )
                    return entry["@name"]
        else:
            log_inventory_sync(
                action="skipped",
                message="Skipping device group without 'devices' key",
            )

    log_inventory_sync(
        action="warning",
        message="Device not found in any device group",
    )
    return None


def log_inventory_sync(
    action: str,
    message: str,
):
    """
    Log an upgrade message with the appropriate emoji based on the action being performed.

    This function logs an upgrade message using the Python logging module. It determines
    the appropriate logging level based on the action and includes additional job details
    such as the job ID and job type in the log record.

    Args:
        action (str): The action being performed (e.g., "start", "success", "error").
        message (str): The log message to be recorded.

    Returns:
        None

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Create extra dictionary with job details]
            B --> C[Get the corresponding emoji based on the action]
            C --> D[Prepend the emoji to the message]
            D --> E[Determine the appropriate logging level based on the action]
            E --> F[Log the message with the determined level and extra details]
            F --> G[End]
        ```
    """
    emoji = get_emoji(action=action)
    message = f"{emoji} {message}"
    extra = {
        "job_id": JOB_ID,
        "job_type": "inventory_sync",
    }

    level_mapping = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
        "critical": logging.CRITICAL,
    }
    level = level_mapping.get(action, logging.INFO)

    logger.log(level, message, extra=extra)


def flatten_xml_to_dict(element: ET.Element) -> dict:
    """
    Flatten an XML element into a dictionary.

    This function recursively flattens an XML element and its child elements into a dictionary.
    It handles the following scenarios:
    - If the child element has text and no further child elements, it is added as a key-value pair to the result dictionary.
    - If the child element has the same tag as an existing key in the result dictionary:
        - If the existing value is not a list, it is converted to a list and the current child element is flattened and appended.
        - If the existing value is already a list, the current child element is flattened and appended to the list.
    - If the child element has a unique tag:
        - If the tag is "entry", it is flattened and added as a single-element list to the result dictionary.
        - Otherwise, it is flattened and added as a key-value pair to the result dictionary.

    Args:
        element (ET.Element): The XML element to be flattened.

    Returns:
        dict: The flattened dictionary representation of the XML element.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Iterate over child elements}
            B --> C{Child element has text and no further child elements?}
            C -->|Yes| D[Add as key-value pair to result dictionary]
            C -->|No| E{Child element tag already exists in result dictionary?}
            E -->|Yes| F{Existing value is a list?}
            F -->|Yes| G[Flatten child element and append to the list]
            F -->|No| H[Convert existing value to a list and append flattened child element]
            E -->|No| I{Child element tag is "entry"?}
            I -->|Yes| J[Flatten child element and add as a single-element list to result dictionary]
            I -->|No| K[Flatten child element and add as key-value pair to result dictionary]
            D --> B
            G --> B
            H --> B
            J --> B
            K --> B
            B --> L[Return flattened dictionary]
        ```
    """
    log_inventory_sync(
        action="start",
        message="Flattening XML element to dictionary",
    )
    result = {}
    for child_element in element:
        child_tag = child_element.tag

        # If the child element has text and no further child elements, add it as a key-value pair to the result dictionary
        if child_element.text and len(child_element) == 0:
            log_inventory_sync(
                action="info",
                message=f"Adding key-value pair to result dictionary: {child_tag}",
            )
            result[child_tag] = child_element.text
        else:
            # If the child element tag already exists in the result dictionary
            if child_tag in result:
                # If the existing value is not a list, convert it to a list and append the flattened child element
                if not isinstance(result.get(child_tag), list):
                    log_inventory_sync(
                        action="info",
                        message=f"Converting existing value to list and appending flattened child element: {child_tag}",
                    )
                    result[child_tag] = [
                        result.get(child_tag),
                        flatten_xml_to_dict(element=child_element),
                    ]
                # If the existing value is already a list, append the flattened child element to the list
                else:
                    log_inventory_sync(
                        action="info",
                        message=f"Appending flattened child element to existing list: {child_tag}",
                    )
                    result[child_tag].append(flatten_xml_to_dict(element=child_element))
            else:
                # If the child element tag is "entry", flatten it and add as a single-element list to the result dictionary
                if child_tag == "entry":
                    log_inventory_sync(
                        action="info",
                        message=f"Flattening child element and adding as single-element list: {child_tag}",
                    )
                    result[child_tag] = [flatten_xml_to_dict(element=child_element)]
                # Otherwise, flatten the child element and add as a key-value pair to the result dictionary
                else:
                    log_inventory_sync(
                        action="info",
                        message=f"Flattening child element and adding as key-value pair: {child_tag}",
                    )
                    result[child_tag] = flatten_xml_to_dict(element=child_element)

    log_inventory_sync(
        action="success",
        message="XML element flattened to dictionary successfully",
    )
    return result


def get_device_group_mapping(pan: Panorama) -> List[Dict]:
    """
    Retrieve the device group mappings from a Panorama instance.

    This function retrieves the device group mappings by querying the Panorama instance
    using the 'show devicegroups' operational command. It parses the XML response and
    constructs a list of dictionaries representing the device group mappings.

    Each device group mapping dictionary contains the following keys:
    - '@name': The name of the device group.
    - 'devices' (optional): A list of devices associated with the device group.

    Each device dictionary within the 'devices' list contains the following keys:
    - '@name': The name of the device.
    - 'serial': The serial number of the device.
    - 'connected': The connection status of the device.

    Args:
        pan (Panorama): The Panorama instance to retrieve the device group mappings from.

    Returns:
        List[Dict]: A list of dictionaries representing the device group mappings.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Query Panorama for device groups]
            B --> C[Iterate over device group entries]
            C --> D{Device group has devices?}
            D -->|Yes| E[Iterate over device entries]
            E --> F[Create device dictionary]
            F --> G[Append device dictionary to devices list]
            G --> H[Add devices list to device group dictionary]
            D -->|No| H
            H --> I[Append device group dictionary to mappings list]
            I --> J{More device group entries?}
            J -->|Yes| C
            J -->|No| K[Return device group mappings]
        ```
    """
    log_inventory_sync(
        action="start",
        message="Retrieving device group mappings from Panorama",
    )
    device_group_mappings = []
    device_groups = pan.op("show devicegroups")

    # Iterate over each 'entry' element under 'devicegroups'
    for entry in device_groups.findall(".//devicegroups/entry"):
        log_inventory_sync(
            action="search",
            message=f"Processing device group: {entry.get('name')}",
        )
        entry_dict = {"@name": entry.get("name")}

        # Check if the 'entry' has 'devices' element
        devices_elem = entry.find("devices")
        if devices_elem is not None:
            devices = []

            # Iterate over each 'entry' element under 'devices'
            for device in devices_elem.findall("entry"):
                log_inventory_sync(
                    action="search",
                    message=f"Processing device: {device.get('name')}",
                )
                device_dict = {
                    "@name": device.get("name"),
                    "serial": device.find("serial").text,
                    "connected": device.find("connected").text,
                }
                devices.append(device_dict)

            entry_dict["devices"] = devices

        device_group_mappings.append(entry_dict)

    log_inventory_sync(
        action="success",
        message="Device group mappings retrieved successfully",
    )
    return device_group_mappings


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


def run_inventory_sync(
    author_id: int,
    job_id: str,
    panorama_device_uuid: str,
    profile_uuid: str,
) -> str:
    """
    Perform an inventory sync for a Panorama device.

    This function retrieves the connected devices from a Panorama device and creates or updates
    the corresponding Device objects in the database. It also handles the assignment of peer devices
    for HA deployments.

    Args:
        author_id (int): The ID of the author performing the inventory sync.
        job_id (str): The unique identifier of the inventory sync job.
        panorama_device_uuid (str): The UUID of the Panorama device.
        profile_uuid (str): The UUID of the profile associated with the Panorama device.

    Returns:
        str: The JSON output containing the retrieved device information.

    Raises:
        Exception: If an error occurs during the inventory sync process.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Log inventory sync details]
            B --> C[Retrieve Panorama device and profile from database]
            C --> D[Connect to Panorama device]
            D --> E[Retrieve system info and device group mappings]
            E --> F[Retrieve connected devices]
            F --> G[Create/update Device objects]
            G --> H[Update peer device information for HA deployments]
            H --> I[Return JSON output]
            I --> J[Log any errors and raise exception]
            J --> K[End]
        ```
    """

    global JOB_ID
    JOB_ID = job_id

    log_inventory_sync(
        action="start",
        message=f"Running inventory sync for Panorama device: {panorama_device_uuid}",
    )

    log_inventory_sync(
        action="info",
        message=f"Using profile: {profile_uuid}",
    )
    log_inventory_sync(
        action="info",
        message=f"Author ID: {author_id}",
    )

    log_inventory_sync(
        action="start",
        message="Starting inventory sync",
    )
    try:
        # Retrieve the Panorama device and profile objects from the database
        panorama_device = Device.objects.get(uuid=panorama_device_uuid)
        log_inventory_sync(
            action="search",
            message=f"Retrieved Panorama device: {panorama_device.hostname}",
        )

        profile = Profile.objects.get(uuid=profile_uuid)
        log_inventory_sync(
            action="search",
            message=f"Retrieved profile: {profile.name}",
        )

        # Access the authentication data directly from the profile fields
        pan_username = profile.pan_username
        pan_password = profile.pan_password

        # Connect to the Panorama device using the retrieved credentials
        pan = Panorama(
            (
                panorama_device.ipv4_address
                if panorama_device.ipv4_address
                else panorama_device.ipv6_address
            ),
            pan_username,
            pan_password,
        )
        log_inventory_sync(
            action="info",
            message=f"Connected to Panorama device: {panorama_device.ipv4_address}",
        )

        # Retrieve the system information from the Panorama device
        system_info = pan.show_system_info()
        panorama_hostname = system_info["system"]["hostname"]
        log_inventory_sync(
            action="search",
            message=f"Connected to Panorama device: {panorama_hostname}",
        )

        # Retrieve the device group mappings from the Panorama device
        device_group_mappings = get_device_group_mapping(pan)
        log_inventory_sync(
            action="search",
            message=f"Retrieved device group mappings {device_group_mappings}",
        )

        # Retrieve the connected devices
        connected_devices = pan.op("show devices connected")
        result_dict = flatten_xml_to_dict(element=connected_devices)
        log_inventory_sync(
            action="search",
            message=f"Retrieved connected devices {result_dict['result']['devices']}",
        )

        # Convert the result dictionary to JSON
        json_output = json.dumps(result_dict)

        # Create a list of peer firewalls missing their HA partner
        missing_peer_devices = []

        log_inventory_sync(
            action="start",
            message="Starting device creation/update",
        )
        # Step 1: Create or update Device objects based on the retrieved devices
        for device in result_dict["result"]["devices"]["entry"]:
            platform_name = device["model"]

            # Retrieve the DeviceType object based on the platform_name
            try:
                platform = DeviceType.objects.get(name=platform_name)
            except ObjectDoesNotExist:
                # Handle the case when the platform doesn't exist
                log_inventory_sync(
                    action="skipped",
                    message=f"Platform '{platform_name}' not found. Skipping device: {device['@name']}",
                )
                continue
            log_inventory_sync(
                action="search",
                message=f"Retrieved platform: {platform.name}",
            )

            # Build connection to firewall device through Panorama object
            firewall = Firewall(serial=device["serial"])
            pan.add(firewall)

            # Retrieve the system information from the firewall device
            info = firewall.show_system_info()
            log_inventory_sync(
                action="search",
                message=f"Retrieved system info for device: {info['system']['hostname']}",
            )
            log_inventory_sync(
                action="debug",
                message=f"System info: {info}",
            )

            # Retrieve the HA state information from the firewall device
            ha_info = firewall.show_highavailability_state()
            log_inventory_sync(
                action="search",
                message=f"Retrieved HA state for device: {info['system']['hostname']}",
            )

            ha_enabled = ha_info[0] != "disabled"

            peer_device_uuid = None
            peer_ip = None
            peer_state = None
            local_state = None

            if ha_enabled:
                ha_details = flatten_xml_to_dict(element=ha_info[1])
                log_inventory_sync(
                    action="debug",
                    message=f"HA details: {ha_details}",
                )
                peer_ip = ha_details["result"]["group"]["peer-info"]["mgmt-ip"].split(
                    "/"
                )[0]
                local_state = ha_details["result"]["group"]["local-info"]["state"]

                try:
                    peer_device = Device.objects.get(ipv4_address=peer_ip)
                    peer_device_uuid = str(peer_device.uuid)
                    peer_state = ha_details["result"]["group"]["peer-info"]["state"]
                except ObjectDoesNotExist:
                    # When the peer device doesn't yet exist, we will revisit after creation.
                    missing_peer_devices.append(firewall)

                    log_inventory_sync(
                        action="skipped",
                        message=f"Peer device with IP {peer_ip} not found. Skipping HA deployment.",
                    )

            panorama_appliance_uuid = None
            if panorama_hostname:
                try:
                    panorama_appliance = Device.objects.get(hostname=panorama_hostname)
                    panorama_appliance_uuid = str(panorama_appliance.uuid)
                    log_inventory_sync(
                        action="search",
                        message=f"Retrieved Panorama appliance: {panorama_appliance.hostname}",
                    )
                except ObjectDoesNotExist:
                    log_inventory_sync(
                        action="skipped",
                        message=f"Panorama appliance '{panorama_hostname}' not found. Skipping assignment.",
                    )

            # Create or update the Device object
            Device.objects.update_or_create(
                hostname=info["system"]["hostname"],
                defaults={
                    "app_version": info["system"]["app-version"],
                    "author_id": author_id,
                    "device_group": find_devicegroup_by_serial(
                        device_group_mappings,
                        device["serial"],
                    ),
                    "ha_enabled": ha_enabled,
                    "ipv4_address": (
                        info["system"]["ip-address"]
                        if info["system"]["ip-address"] != "unknown"
                        else None
                    ),
                    "ipv6_address": (
                        info["system"]["ipv6-address"]
                        if info["system"]["ipv6-address"] != "unknown"
                        else None
                    ),
                    "local_state": local_state,
                    "notes": None,
                    "platform": platform,
                    "panorama_appliance_id": panorama_appliance_uuid,
                    "panorama_managed": True,
                    "panorama_ipv4_address": panorama_device.ipv4_address,
                    "panorama_ipv6_address": panorama_device.ipv6_address,
                    "peer_device_id": peer_device_uuid,
                    "peer_ip": peer_ip,
                    "peer_state": peer_state,
                    "serial": info["system"]["serial"],
                    "sw_version": info["system"]["sw-version"],
                    "threat_version": info["system"]["threat-version"],
                    "uptime": info["system"]["uptime"],
                },
            )
            log_inventory_sync(
                action="save",
                message=f"Created/updated device: {info['system']['hostname']}",
            )

        # Step 2: Revisit the missing peer devices and update the peer_device_id
        log_inventory_sync(
            action="start",
            message="Starting missing peer device update",
        )
        for firewall in missing_peer_devices:
            ha_info = firewall.show_highavailability_state()
            ha_details = flatten_xml_to_dict(element=ha_info[1])
            peer_ip = ha_details["result"]["group"]["peer-info"]["mgmt-ip"].split("/")[
                0
            ]

            try:
                peer_device = Device.objects.get(ipv4_address=peer_ip)
                peer_device_uuid = str(peer_device.uuid)
                peer_state = ha_details["result"]["group"]["peer-info"]["state"]
                log_inventory_sync(
                    action="search",
                    message=f"Retrieved peer device: {peer_device.hostname}",
                )
            except ObjectDoesNotExist:
                log_inventory_sync(
                    action="error",
                    message=f"Peer device with IP {peer_ip} still not found. Skipping HA deployment.",
                )
                continue

            Device.objects.filter(serial=firewall.serial).update(
                peer_device_id=peer_device_uuid, peer_ip=peer_ip, peer_state=peer_state
            )
            log_inventory_sync(
                action="save",
                message=f"Updated peer device for: {firewall.serial}",
            )
        return json_output

    except Exception as e:
        log_inventory_sync(
            action="error",
            message=f"Error during inventory sync: {str(e)}",
        )
        raise e


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Run inventory sync script for Palo Alto Networks devices"
    )
    parser.add_argument(
        "-p",
        "--panorama-device-uuid",
        type=str,
        required=True,
        help="UUID of the Panorama device to sync inventory from",
    )
    parser.add_argument(
        "-r",
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
        help="ID of the author performing the inventory sync",
    )

    args = parser.parse_args()

    panorama_device_uuid = args.panorama_device_uuid
    profile_uuid = args.profile_uuid
    author_id = args.author_id

    run_inventory_sync(
        author_id=author_id,
        job_id="CLI",
        panorama_device_uuid=panorama_device_uuid,
        profile_uuid=profile_uuid,
    )
