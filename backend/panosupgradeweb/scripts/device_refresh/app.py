# backend/panosupgradeweb/scripts/device_refresh/app.py
import os
import sys
import argparse
import json
import logging
import xml.etree.ElementTree as ET
import uuid

import django
from typing import List, Dict, Optional

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
from panosupgradeweb.models import (  # noqa: E402
    Device,
    DeviceType,
    Job,
    JobLogEntry,
    Profile,
)
from django.core.exceptions import ObjectDoesNotExist  # noqa: E402
from django.utils import timezone  # noqa: E402


# Create a logger instance
logger = logging.getLogger("pan-os-device-refresh")
logger.setLevel(logging.DEBUG)

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

    This function iterates through a list of device group entries and searches for a device
    with the specified serial number. If a match is found, the function returns the name of
    the device group. If no match is found, the function returns None.

    Args:
        data (List[Dict]): A list of device group entries, where each entry is a dictionary.
        serial (str): The serial number of the device to search for.

    Returns:
        Optional[str]: The name of the device group if a match is found, or None if no match is found.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Iterate through device group entries}
            B -->|Entry found| C{Entry contains 'devices' key?}
            C -->|Yes| D{Iterate through devices in entry}
            D -->|Device found| E{Device serial matches target serial?}
            E -->|Yes| F[Return device group name]
            E -->|No| D
            C -->|No| B
            D -->|No more devices| B
            B -->|No more entries| G[Return None]
        ```
    """
    log_device_refresh(
        action="start",
        message=f"Searching for device group with serial number: {serial}",
    )

    for entry in data:
        if "devices" in entry:
            log_device_refresh(
                action="search",
                message=f"Checking devices in device group: {entry['@name']}",
            )
            for device in entry["devices"]:
                if device["serial"] == serial:
                    log_device_refresh(
                        action="success",
                        message=f"Found device with serial number {serial} in device group: {entry['@name']}",
                    )
                    return entry["@name"]
        else:
            log_device_refresh(
                action="skipped",
                message=f"Skipping entry without 'devices' key: {entry}",
            )

    log_device_refresh(
        action="warning",
        message=f"No device group found for serial number: {serial}",
    )
    return None


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
    result = {}
    for child_element in element:
        child_tag = child_element.tag

        # If the child element has text and no further child elements, add it as a key-value pair to the result dictionary
        if child_element.text and len(child_element) == 0:
            result[child_tag] = child_element.text
        else:
            # If the child element tag already exists in the result dictionary
            if child_tag in result:
                # If the existing value is not a list, convert it to a list and append the flattened child element
                if not isinstance(result.get(child_tag), list):
                    result[child_tag] = [
                        result.get(child_tag),
                        flatten_xml_to_dict(element=child_element),
                    ]
                # If the existing value is already a list, append the flattened child element to the list
                else:
                    result[child_tag].append(flatten_xml_to_dict(element=child_element))
            else:
                # If the child element tag is "entry", flatten it and add as a single-element list to the result dictionary
                if child_tag == "entry":
                    result[child_tag] = [flatten_xml_to_dict(element=child_element)]
                # Otherwise, flatten the child element and add as a key-value pair to the result dictionary
                else:
                    result[child_tag] = flatten_xml_to_dict(element=child_element)

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
    log_device_refresh(
        action="start",
        message="Retrieving device group mappings from Panorama",
    )
    device_group_mappings = []
    device_groups = pan.op("show devicegroups")

    # Iterate over each 'entry' element under 'devicegroups'
    for entry in device_groups.findall(".//devicegroups/entry"):
        log_device_refresh(
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
                log_device_refresh(
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

    log_device_refresh(
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


def log_device_refresh(
    action: str,
    message: str,
):
    """
    Log a message related to device refresh with the appropriate emoji and log level.

    This function takes an action and a message as input, and logs the message with the
    corresponding emoji and log level based on the action. It also includes additional
    information such as the job ID and job type in the log record.

    Args:
        action (str): The action associated with the log message. It determines the log level
                      and the emoji to be used. Valid actions are: "DEBUG", "INFO", "WARNING",
                      "ERROR", "CRITICAL" (case-insensitive).
        message (str): The log message to be recorded.

    Returns:
        None

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Get emoji based on action]
            B --> C[Prepend emoji to the message]
            C --> D[Create extra dictionary with job_id and job_type]
            D --> E[Log the message with the corresponding log level, message, and extra information]
            E --> F[End]
        ```
    """

    # Get the appropriate emoji based on the action
    emoji = get_emoji(action=action.lower())

    # Prepend the emoji to the message
    message = f"{emoji} {message}"

    level_mapping = {
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warning": logging.WARNING,
        "error": logging.ERROR,
        "critical": logging.CRITICAL,
    }
    severity_level = action
    level = level_mapping.get(action, logging.INFO)

    timestamp = timezone.now()

    # Save the log entry to the database
    try:
        job = Job.objects.get(task_id=JOB_ID)
        log_entry = JobLogEntry(
            job=job,
            timestamp=timestamp,
            severity_level=severity_level,
            message=message,
        )
        log_entry.save()
    except Job.DoesNotExist:
        pass

    logger.log(level, message)


def run_device_refresh(
    author_id: int,
    device_uuid: str,
    job_id: str,
    profile_uuid: str,
) -> str:
    """
    Refresh the device information and update the corresponding Device object in the database.

    This function connects to a PAN device (firewall or Panorama) using the provided credentials,
    retrieves the system information, and updates the corresponding Device object in the database
    with the retrieved information. It also handles the case of a firewall device managed by Panorama.

    Args:
        author_id (int): The ID of the author performing the device refresh.
        device_uuid (str): The UUID of the device to be refreshed.
        job_id (str): The ID of the job associated with the device refresh.
        profile_uuid (str): The UUID of the profile containing the PAN device credentials.

    Returns:
        str: A JSON string containing the updated device information.

    Raises:
        Exception: If an error occurs while connecting to the PAN device or retrieving system information.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Set JOB_ID global variable]
            B --> C[Log device refresh details]
            C --> D[Initialize device_data dictionary]
            D --> E[Retrieve Device, Profile, and Platform objects from the database]
            E --> F{Platform device type?}
            F -->|Firewall and not Panorama-managed| G[Connect to firewall directly]
            F -->|Firewall and Panorama-managed| H[Connect to firewall through Panorama]
            F -->|Panorama| I[Connect to Panorama]
            G --> J[Retrieve system information]
            H --> J
            I --> J
            J --> K[Store system information in device_data]
            K --> L{Platform device type and HA enabled?}
            L -->|Firewall and HA enabled| M[Retrieve HA state information]
            L -->|Firewall and HA disabled or Panorama| N[Set ha_enabled to False]
            M --> O[Parse HA state information and store in device_data]
            N --> P[Store additional device information in device_data]
            O --> P
            P --> Q[Update Device object in the database]
            Q --> R[Serialize device_data to JSON]
            R --> S[Return JSON string]
            S --> T[End]
        ```
    """

    # JOB_ID global variable
    global JOB_ID
    JOB_ID = job_id

    log_device_refresh(
        action="start",
        message=f"Running device refresh for device: {device_uuid}",
    )
    log_device_refresh(
        action="info",
        message=f"Using profile: {profile_uuid}",
    )
    log_device_refresh(
        action="info",
        message=f"Author ID: {author_id}",
    )

    # Initialize an empty dictionary to store the device data
    device_data = {}

    # Retrieve the PAN device, device type, profile, and job objects from the database
    device = Device.objects.get(uuid=device_uuid)
    profile = Profile.objects.get(uuid=profile_uuid)
    platform = device.platform
    job = Job.objects.get(task_id=job_id)

    # Build the PAN device object
    try:
        # If the device is not managed by Panorama, connect to it directly
        if platform.device_type == "Firewall" and not device.panorama_managed:
            # Connect to the firewall device using the retrieved credentials
            pan_device = Firewall(
                device.ipv4_address,
                profile.pan_username,
                profile.pan_password,
            )
            log_device_refresh(
                action="success",
                message=f"Connected to firewall device {device.ipv4_address}",
            )

        elif platform.device_type == "Firewall" and device.panorama_managed:
            # If the device is managed by Panorama, connect to it through Panorama
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
                action="success",
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
                action="success",
                message=f"Connected to Panorama device {device.ipv4_address}",
            )

    except Exception as e:
        log_device_refresh(
            action="error",
            message=f"Error while retrieving system information: {str(e)}",
        )
        job.job_status = "errored"
        job.save()
        return "errored"

    # Connect to the PAN device and retrieve the system information
    try:
        # Retrieve the system information from the firewall device
        log_device_refresh(
            action="search",
            message=f"Retrieving system information from device {device.ipv4_address}",
        )
        system_info = pan_device.show_system_info()
        log_device_refresh(
            action="success",
            message=f"Retrieved system information from device {device.ipv4_address}",
        )
        log_device_refresh(
            action="debug",
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
        log_device_refresh(
            action="search",
            message=f"Retrieving HA state information from device {device.ipv4_address}",
        )
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
                    action="warning",
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
            action="debug",
            message=f"Device Data: {device_data}",
        )

        # Update the Device object using the device_data dictionary
        log_device_refresh(
            action="save",
            message=f"Updating device {device_data['hostname']} in the database",
        )
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
            action="success",
            message=f"Device {device_data['hostname']} updated successfully",
        )

        # Serialize the device_data dictionary to JSON
        log_device_refresh(
            action="report",
            message="Serializing device data to JSON",
        )
        return "completed"

    except Exception as e:
        log_device_refresh(
            action="error",
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
