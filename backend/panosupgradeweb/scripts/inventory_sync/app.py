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
logger = logging.getLogger("pan-os-inventory")
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


def log_inventory_sync(
    job_id: str,
    level: str,
    message: str,
):
    extra = {
        "job_id": job_id,
        "job_type": "inventory_sync",
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


def get_device_group_mapping(pan: Panorama):
    device_group_mappings = []
    device_groups = pan.op("show devicegroups")

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


def run_inventory_sync(
    author_id: int,
    job_id: str,
    panorama_device_uuid: str,
    profile_uuid: str,
):
    log_inventory_sync(
        job_id=job_id,
        level="INFO",
        message=f"Running inventory sync for Panorama device: {panorama_device_uuid}",
    )
    log_inventory_sync(
        job_id=job_id,
        level="INFO",
        message=f"Using profile: {profile_uuid}",
    )
    log_inventory_sync(
        job_id=job_id,
        level="INFO",
        message=f"Author ID: {author_id}",
    )

    log_inventory_sync(
        job_id=job_id,
        level="INFO",
        message="Starting inventory sync",
    )
    try:
        # Retrieve the Panorama device and profile objects from the database
        panorama_device = Device.objects.get(uuid=panorama_device_uuid)
        log_inventory_sync(
            job_id=job_id,
            level="DEBUG",
            message=f"Retrieved Panorama device: {panorama_device.hostname}",
        )

        profile = Profile.objects.get(uuid=profile_uuid)
        log_inventory_sync(
            job_id=job_id,
            level="DEBUG",
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
            job_id=job_id,
            level="DEBUG",
            message=f"Connected to Panorama device: {panorama_device.ipv4_address}",
        )

        # Retrieve the system information from the Panorama device
        system_info = pan.show_system_info()
        panorama_hostname = system_info["system"]["hostname"]
        log_inventory_sync(
            job_id=job_id,
            level="DEBUG",
            message=f"Connected to Panorama device: {panorama_hostname}",
        )

        # Retrieve the device group mappings from the Panorama device
        device_group_mappings = get_device_group_mapping(pan)
        log_inventory_sync(
            job_id=job_id,
            level="DEBUG",
            message=f"Retrieved device group mappings {device_group_mappings}",
        )

        # Retrieve the connected devices
        connected_devices = pan.op("show devices connected")
        result_dict = flatten_xml_to_dict(element=connected_devices)
        log_inventory_sync(
            job_id=job_id,
            level="DEBUG",
            message=f"Retrieved connected devices {result_dict['result']['devices']}",
        )

        # Convert the result dictionary to JSON
        json_output = json.dumps(result_dict)

        # Create a list of peer firewalls missing their HA partner
        missing_peer_devices = []

        log_inventory_sync(
            job_id=job_id,
            level="INFO",
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
                logging.warning(
                    f"Platform '{platform_name}' not found. Skipping device: {device['@name']}"
                )
                continue
            log_inventory_sync(
                job_id=job_id,
                level="DEBUG",
                message=f"Retrieved platform: {platform.name}",
            )

            # Build connection to firewall device through Panorama object
            firewall = Firewall(serial=device["serial"])
            pan.add(firewall)

            # Retrieve the system information from the firewall device
            info = firewall.show_system_info()
            log_inventory_sync(
                job_id=job_id,
                level="INFO",
                message=f"Retrieved system info for device: {info['system']['hostname']}",
            )
            log_inventory_sync(
                job_id=job_id,
                level="DEBUG",
                message=f"System info: {info}",
            )

            # Retrieve the HA state information from the firewall device
            ha_info = firewall.show_highavailability_state()
            log_inventory_sync(
                job_id=job_id,
                level="INFO",
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
                    job_id=job_id,
                    level="DEBUG",
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
                    # When the peer device doesn't yet exist we will revisit after creation.
                    missing_peer_devices.append(firewall)

                    logging.warning(
                        f"Peer device with IP {peer_ip} not found. Skipping HA deployment."
                    )

            panorama_appliance_uuid = None
            if panorama_hostname:
                try:
                    panorama_appliance = Device.objects.get(hostname=panorama_hostname)
                    panorama_appliance_uuid = str(panorama_appliance.uuid)
                    log_inventory_sync(
                        job_id=job_id,
                        level="DEBUG",
                        message=f"Retrieved Panorama appliance: {panorama_appliance.hostname}",
                    )
                except ObjectDoesNotExist:
                    logging.warning(
                        f"Panorama appliance '{panorama_hostname}' not found. Skipping assignment."
                    )

            # Create or update the Device object
            Device.objects.update_or_create(
                hostname=info["system"]["hostname"],
                defaults={
                    "app_version": info["system"]["app-version"],
                    "author_id": author_id,
                    "device_group": find_devicegroup_by_serial(
                        device_group_mappings, device["serial"]
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
                job_id=job_id,
                level="INFO",
                message=f"Created/updated device: {info['system']['hostname']}",
            )

        # Step 2: Revisit the missing peer devices and update the peer_device_id
        log_inventory_sync(
            job_id=job_id,
            level="INFO",
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
                    job_id=job_id,
                    level="DEBUG",
                    message=f"Retrieved peer device: {peer_device.hostname}",
                )
            except ObjectDoesNotExist:
                logging.error(
                    f"Peer device with IP {peer_ip} still not found. Skipping HA deployment."
                )
                continue

            Device.objects.filter(serial=firewall.serial).update(
                peer_device_id=peer_device_uuid, peer_ip=peer_ip, peer_state=peer_state
            )
            log_inventory_sync(
                job_id=job_id,
                level="INFO",
                message=f"Updated peer device for: {firewall.serial}",
            )
        return json_output

    except Exception as e:
        logging.error(f"Error during inventory sync: {str(e)}")
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
