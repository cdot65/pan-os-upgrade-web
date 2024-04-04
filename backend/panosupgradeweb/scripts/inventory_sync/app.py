# backend/panosupgradeweb/scripts/inventory_sync/app.py

import json
import logging
import xml.etree.ElementTree as ET

from panos.firewall import Firewall
from panos.panorama import Panorama
from panosupgradeweb.models import InventoryItem, InventoryPlatform, Profile


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


def run_inventory_sync(
    panorama_device_uuid,
    profile_uuid,
    author_id,
):
    logging.debug(f"Running inventory sync for Panorama device: {panorama_device_uuid}")
    logging.debug(f"Using profile: {profile_uuid}")
    logging.debug(f"Author ID: {author_id}")

    try:
        # Retrieve the Panorama device and profile objects from the database
        panorama_device = InventoryItem.objects.get(uuid=panorama_device_uuid)
        profile = Profile.objects.get(uuid=profile_uuid)

        # Access the authentication data directly from the profile fields
        pan_username = profile.pan_username
        pan_password = profile.pan_password

        # Connect to the Panorama device using the retrieved credentials
        pan = Panorama(
            panorama_device.ipv4_address,
            pan_username,
            pan_password,
        )

        # Retrieve the connected devices
        connected_devices = pan.op("show devices connected")
        result_dict = flatten_xml_to_dict(element=connected_devices)

        # Convert the result dictionary to JSON
        json_output = json.dumps(result_dict, indent=2)

        # Create or update InventoryItem objects based on the retrieved devices
        for device in result_dict["result"]["devices"]["entry"]:
            hostname = device["hostname"]
            ipv4_address = device["ip-address"]
            platform_name = device["model"]

            # Connect to the firewall device
            firewall = Firewall(serial=device["serial"])
            pan.add(firewall)
            info = firewall.show_system_info()

            # Retrieve the InventoryPlatform object based on the platform_name
            try:
                platform = InventoryPlatform.objects.get(name=platform_name)
            except InventoryPlatform.DoesNotExist:
                # Handle the case when the platform doesn't exist
                logging.warning(
                    f"Platform '{platform_name}' not found. Skipping device: {hostname}"
                )
                continue

            # Create or update the InventoryItem object
            inventory_item, created = InventoryItem.objects.update_or_create(
                hostname=hostname,
                defaults={
                    "author_id": author_id,
                    "ipv4_address": ipv4_address,
                    "notes": info,
                    "platform": platform,
                    "panorama_managed": True,
                    "panorama_appliance": pan.hostname,
                },
            )

        return json_output

    except Exception as e:
        logging.error(f"Error during inventory sync: {str(e)}")
        raise e
