# backend/panosupgradeweb/scripts/device_refresh/app.py

import json
import logging
import xml.etree.ElementTree as ET

from panos.firewall import Firewall
from panos.panorama import Panorama
from panosupgradeweb.models import Device, DeviceType, Profile


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


def run_device_refresh(
    device_uuid,
    profile_uuid,
    author_id,
):
    logging.debug(f"Running inventory sync for Panorama device: {device_uuid}")
    logging.debug(f"Using profile: {profile_uuid}")
    logging.debug(f"Author ID: {author_id}")

    try:
        # Retrieve the Panorama device and profile objects from the database
        device = Device.objects.get(uuid=device_uuid)
        profile = Profile.objects.get(uuid=profile_uuid)

        # Access the authentication data directly from the profile fields
        pan_username = profile.pan_username
        pan_password = profile.pan_password

        print(f"Device: {device}")
        print(f"Profile: {profile}")
        print(f"Panorama Username: {pan_username}")
        print(f"Panorama Password: {pan_password}")

        # if the device is not managed by Panorama, then we will connect to it directly
        if not device.panorama_managed:
            # Connect to the firewall device using the retrieved credentials
            firewall = Firewall(
                device.ipv4_address,
                pan_username,
                pan_password,
            )

            # Retrieve the system information from the firewall device
            system_info = firewall.show_system_info()
            platform_name = system_info["system"]["model"]

            # Retrieve the DeviceType object based on the platform_name
            try:
                platform = DeviceType.objects.get(name=platform_name)
            except DeviceType.DoesNotExist:
                # Handle the case when the platform doesn't exist
                logging.warning(
                    f"Platform '{platform_name}' not found. Skipping device: {device.hostname}"
                )
                return

            # Retrieve the HA state information from the firewall device
            ha_info = firewall.show_highavailability_state()

            if ha_info[0] != "disabled":
                ha_state = True
                ha_details = flatten_xml_to_dict(element=ha_info[1])
                ha_mode = ha_details["result"]["group"]["local-info"]["mode"]
                ha_status = ha_details["result"]["group"]["local-info"]["state"]
                ha_peer = ha_details["result"]["group"]["peer-info"]["mgmt-ip"]
            else:
                ha_state = False
                ha_mode = None
                ha_status = None
                ha_peer = None

            # Create or update the Device object
            inventory_item, created = Device.objects.update_or_create(
                hostname=system_info["system"]["hostname"],
                defaults={
                    "app_version": system_info["system"]["app-version"],
                    "author_id": author_id,
                    "device_group": None,
                    "ha": ha_state,
                    "ha_mode": ha_mode,
                    "ha_peer": ha_peer,
                    "ha_status": ha_status,
                    "ipv4_address": system_info["system"]["ip-address"],
                    "ipv6_address": (
                        system_info["system"]["ipv6-address"]
                        if system_info["system"]["ipv6-address"] != "unknown"
                        else None
                    ),
                    "notes": None,
                    "platform": platform,
                    "panorama_managed": False,
                    "panorama_appliance": None,
                    "serial": system_info["system"]["serial"],
                    "sw_version": system_info["system"]["sw-version"],
                    "threat_version": system_info["system"]["threat-version"],
                    "uptime": system_info["system"]["uptime"],
                },
            )

            return json.dumps(created, indent=2)

        else:

            # Connect to the Panorama device using the retrieved credentials
            pan = Panorama(
                device.ipv4_address,
                pan_username,
                pan_password,
            )

            # Retrieve the system information from the Panorama device
            system_info = pan.show_system_info()
            panorama_hostname = system_info["system"]["hostname"]

            # Retrieve the device group mappings from the Panorama device
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

            # Retrieve the connected devices
            connected_devices = pan.op("show devices connected")
            result_dict = flatten_xml_to_dict(element=connected_devices)

            # Create or update Device objects based on the retrieved devices
            for device in result_dict["result"]["devices"]["entry"]:
                platform_name = device["model"]

                # Retrieve the DeviceType object based on the platform_name
                try:
                    platform = DeviceType.objects.get(name=platform_name)
                except DeviceType.DoesNotExist:
                    # Handle the case when the platform doesn't exist
                    logging.warning(
                        f"Platform '{platform_name}' not found. Skipping device: {device.hostname}"
                    )
                    continue

                # build connection to firewall device through Panorama object
                firewall = Firewall(serial=device["serial"])
                pan.add(firewall)

                # Retrieve the system information from the firewall device
                info = firewall.show_system_info()

                # Retrieve the HA state information from the firewall device
                ha_info = firewall.show_highavailability_state()

                if ha_info[0] != "disabled":
                    ha_state = True
                    ha_details = flatten_xml_to_dict(element=ha_info[1])
                    ha_mode = ha_details["result"]["group"]["local-info"]["mode"]
                    ha_status = ha_details["result"]["group"]["local-info"]["state"]
                    ha_peer = ha_details["result"]["group"]["peer-info"]["mgmt-ip"]
                else:
                    ha_state = False
                    ha_details = None
                    ha_mode = None
                    ha_status = None
                    ha_peer = None

                # Create or update the Device object
                inventory_item, created = Device.objects.update_or_create(
                    hostname=info["system"]["hostname"],
                    defaults={
                        "app_version": info["system"]["app-version"],
                        "author_id": author_id,
                        "device_group": find_devicegroup_by_serial(
                            device_group_mappings, device["serial"]
                        ),
                        "ha": ha_state,
                        "ha_mode": ha_mode,
                        "ha_peer": ha_peer,
                        "ha_status": ha_status,
                        "ipv4_address": info["system"]["ip-address"],
                        "ipv6_address": (
                            info["system"]["ipv6-address"]
                            if info["system"]["ipv6-address"] != "unknown"
                            else None
                        ),
                        "notes": None,
                        "platform": platform,
                        "panorama_managed": True,
                        "panorama_appliance": panorama_hostname,
                        "serial": info["system"]["serial"],
                        "sw_version": info["system"]["sw-version"],
                        "threat_version": info["system"]["threat-version"],
                        "uptime": info["system"]["uptime"],
                    },
                )

            return json.dumps(created, indent=2)

    except Exception as e:
        logging.error(f"Error during inventory sync: {str(e)}")
        raise e
