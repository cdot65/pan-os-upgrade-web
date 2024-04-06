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

    # Retrieve the PAN device, device type, and profile objects from the database
    device = Device.objects.get(uuid=device_uuid)
    profile = Profile.objects.get(uuid=profile_uuid)
    platform = DeviceType.objects.get(name=device.platform)

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

        else:

            # Connect to the Panorama device using the retrieved credentials
            pan_device = Panorama(
                device.ipv4_address,
                profile.pan_username,
                profile.pan_password,
            )

    except Exception as e:
        logging.error(f"Error during inventory sync: {str(e)}")
        raise e

    # Connect to the PAN device and retrieve the system information
    try:

        # Retrieve the system information from the firewall device
        system_info = pan_device.show_system_info()

        # Firewalls return model so they can be updated, Panorama does not
        if platform.device_type == "Firewall":
            platform_name = system_info["system"]["model"]
        else:
            platform_name = platform.name

        # Retrieve the HA state information from the firewall device
        ha_info = pan_device.show_highavailability_state()

        # Parse the HA state information
        if platform.device_type == "Firewall" and ha_info[0] != "disabled":
            ha_state = True
            ha_details = flatten_xml_to_dict(element=ha_info[1])
            ha_mode = ha_details["result"]["group"]["local-info"]["mode"]
            ha_status = ha_details["result"]["group"]["local-info"]["state"]
            ha_peer = ha_details["result"]["group"]["peer-info"]["mgmt-ip"].split("/")[
                0
            ]
        elif platform.device_type == "Panorama" and ha_info[0] != "disabled":
            ha_state = True
            ha_details = flatten_xml_to_dict(element=ha_info[1])
            ha_mode = ha_details["result"]["local-info"]["mode"]
            ha_status = ha_details["result"]["local-info"]["state"]
            ha_peer = ha_details["result"]["peer-info"]["mgmt-ip"].split("/")[0]
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
                "platform": platform_name,
                "panorama_managed": device.panorama_managed,
                "panorama_appliance": (
                    device.panorama_appliance if device.panorama_managed else None
                ),
                "serial": system_info["system"]["serial"],
                "sw_version": system_info["system"]["sw-version"],
                "threat_version": system_info["system"]["threat-version"],
                "uptime": system_info["system"]["uptime"],
            },
        )

        return json.dumps(created, indent=2)

    except Exception as e:
        logging.error(f"Error during inventory sync: {str(e)}")
        raise e
