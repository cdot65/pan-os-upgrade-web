# backend/panosupgradeweb/scripts/panos_upgrade/app.py

import argparse
import json
import logging
import os
import re
import sys
import time

from typing import Dict, List, Optional, Tuple, Union
import uuid

import django
from django.contrib.auth import get_user_model
from logstash_async.handler import AsynchronousLogstashHandler

# Palo Alto Networks SDK imports
from panos.base import PanDevice
from panos.errors import (
    PanConnectionTimeout,
    PanURLError,
    PanXapiError,
    PanDeviceXapiError,
)
from panos.firewall import Firewall
from panos.panorama import Panorama

# Palo Alto Networks Assurance imports
from panos_upgrade_assurance.check_firewall import CheckFirewall
from panos_upgrade_assurance.firewall_proxy import FirewallProxy

# project imports
from pan_os_upgrade.components.utilities import flatten_xml_to_dict
from pan_os_upgrade.components.assurance import AssuranceOptions

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
    Job,
    Profile,
    ReadinessCheckLog,
    SnapshotLog,
    UpgradeLog,
)


# Create a logger instance
logger = logging.getLogger("pan-os-upgrade-upgrade")
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


# Create JOB_ID global variable
global JOB_ID
JOB_ID = ""


def check_ha_compatibility(
    device: Dict,
    current_major: int,
    current_minor: int,
    target_major: int,
    target_minor: int,
) -> bool:
    """
    Check the compatibility of upgrading a firewall in an HA pair to a target version.

    This function compares the current version and target version of a firewall in an HA pair
    to determine if the upgrade is compatible. It checks for the following scenarios:
    - If the major upgrade is more than one release apart
    - If the upgrade is within the same major version but the minor upgrade is more than one release apart
    - If the upgrade spans exactly one major version but also increases the minor version

    Args:
        device (Dict): A dictionary containing information about the firewall device.
        current_major (int): The current major version of the firewall.
        current_minor (int): The current minor version of the firewall.
        target_major (int): The target major version for the upgrade.
        target_minor (int): The target minor version for the upgrade.

    Returns:
        bool: True if the upgrade is compatible, False otherwise.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Major upgrade more than one release apart?}
            B -->|Yes| C[Log warning and return False]
            B -->|No| D{Within same major version and minor upgrade more than one release apart?}
            D -->|Yes| E[Log warning and return False]
            D -->|No| F{Spans exactly one major version and increases minor version?}
            F -->|Yes| G[Log warning and return False]
            F -->|No| H[Log compatibility check success and return True]
        ```
    """

    # Check if the major upgrade is more than one release apart
    if target_major - current_major > 1:
        log_upgrade(
            level="WARNING",
            message=f"{get_emoji(action='warning')} {device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that is more than one major release apart may cause compatibility issues.",
        )
        return False

    # Check if the upgrade is within the same major version but the minor upgrade is more than one release apart
    elif target_major == current_major and target_minor - current_minor > 1:
        log_upgrade(
            level="WARNING",
            message=f"{get_emoji(action='warning')} {device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that is more than one minor release apart may cause compatibility issues.",
        )
        return False

    # Check if the upgrade spans exactly one major version but also increases the minor version
    elif target_major - current_major == 1 and target_minor > 0:
        log_upgrade(
            level="WARNING",
            message=f"{get_emoji(action='warning')} {device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that spans more than one major release or increases the minor version beyond the first in the next major release may cause compatibility issues.",
        )
        return False

    # Log compatibility check success
    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='success')} {device['db_device'].hostname}: The target version is compatible with the current version.",
    )
    return True


def compare_versions(
    version1: str,
    version2: str,
) -> str:
    """
    Compare two version strings and determine their relative order.

    This function takes two version strings as input and compares them to determine
    which version is older, newer, or equal. It uses the `parse_version` function
    to parse the version strings into comparable objects.

    Args:
        version1 (str): The first version string to compare.
        version2 (str): The second version string to compare.

    Returns:
        str: The relative order of the versions:
            - "older" if version1 is older than version2
            - "newer" if version1 is newer than version2
            - "equal" if version1 is equal to version2

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Parse version1]
            A --> C[Parse version2]
            B --> D{Compare parsed versions}
            C --> D
            D -->|version1 < version2| E[Return "older"]
            D -->|version1 > version2| F[Return "newer"]
            D -->|version1 == version2| G[Return "equal"]
        ```
    """

    # Parse the version strings into comparable objects
    parsed_version1 = parse_version(version=version1)
    parsed_version2 = parse_version(version=version2)

    # Compare the parsed versions and return the relative order
    if parsed_version1 < parsed_version2:
        return "older"
    elif parsed_version1 > parsed_version2:
        return "newer"
    else:
        return "equal"


def determine_upgrade(
    device: Dict,
    target_maintenance: Union[int, str],
    target_major: int,
    target_minor: int,
) -> None:
    """
    Determine if a firewall requires an upgrade based on the current and target versions.

    This function compares the current version of a firewall with the target version to determine
    if an upgrade is necessary. It handles both integer and string maintenance versions and logs
    the appropriate messages based on the upgrade requirement.

    Args:
        device (Dict): A dictionary containing information about the firewall device.
        target_maintenance (Union[int, str]): The target maintenance version, which can be an integer or a string.
        target_major (int): The target major version for the upgrade.
        target_minor (int): The target minor version for the upgrade.

    Returns:
        None

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Is target_maintenance an integer?}
            B -->|Yes| C[Set target_version with integer maintenance]
            B -->|No| D[Parse target_version from string]
            C --> E[Log current and target versions]
            D --> E
            E --> F{Is current_version_parsed less than target_version?}
            F -->|Yes| G[Log upgrade required message]
            F -->|No| H[Log no upgrade required or downgrade attempt detected]
            H --> I[Log halting upgrade message]
            I --> J[Exit the script]
        ```
    """

    # Parse the current version of the firewall
    current_version_parsed = parse_version(version=device["db_device"].sw_version)

    if isinstance(target_maintenance, int):
        # Handling integer maintenance version separately
        target_version = (target_major, target_minor, target_maintenance, 0)
    else:
        # Handling string maintenance version with hotfix
        target_version = parse_version(
            version=f"{target_major}.{target_minor}.{target_maintenance}"
        )

    # Log the current and target versions
    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Current version: {device['db_device'].sw_version}.",
    )
    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Target version: {target_major}.{target_minor}.{target_maintenance}.",
    )

    if current_version_parsed < target_version:
        # Log upgrade required message if the current version is less than the target version
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='success')} {device['db_device'].hostname}: Upgrade required from {device['db_device'].sw_version} to {target_major}.{target_minor}.{target_maintenance}",
        )
    else:
        # Log no upgrade required or downgrade attempt detected message
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='skipped')} {device['db_device'].hostname}: No upgrade required or downgrade attempt detected.",
        )
        # Log halting upgrade message and exit the script
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='skipped')} {device['db_device'].hostname}: Halting upgrade.",
        )
        sys.exit(0)


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


def get_ha_status(device: Dict) -> Tuple[str, Optional[dict]]:
    """
    Retrieve the deployment information and HA status of a firewall device.

    This function uses the `show_highavailability_state()` method to retrieve the deployment type
    and HA details of the specified firewall device. It logs the progress and results of the operation
    using the `log_upgrade()` function.

    Args:
        device (Dict): A dictionary containing information about the firewall device.
            The dictionary should include the following keys:
            - 'db_device': An object representing the device in the database, with a 'hostname' attribute.
            - 'pan_device': An object representing the PAN device, with a 'serial' attribute.

    Returns:
        Tuple[str, Optional[dict]]: A tuple containing two elements:
            - The deployment type of the firewall device as a string.
            - A dictionary containing the HA details if available, or None if no HA details are found.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Log start of getting deployment information]
            B --> C[Get deployment type using show_highavailability_state()]
            C --> D[Log target device deployment type]
            D --> E{HA details available?}
            E -->|Yes| F[Flatten XML to dictionary]
            F --> G[Log target device deployment details collected]
            E -->|No| H[Return deployment type and None]
            G --> I[Return deployment type and HA details]
        ```
    """

    # Log the start of getting deployment information
    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='start')} {device['db_device'].hostname}: Getting {device['pan_device'].serial} deployment information.",
    )

    # Get the deployment type using show_highavailability_state()
    deployment_type = device["pan_device"].show_highavailability_state()

    # Log the target device deployment type
    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device deployment: {deployment_type[0]}",
    )

    if deployment_type[1]:
        # Flatten the XML to a dictionary if HA details are available
        ha_details = flatten_xml_to_dict(element=deployment_type[1])

        # Log that the target device deployment details have been collected
        log_upgrade(
            level="DEBUG",
            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device deployment details collected.",
        )
        return deployment_type[0], ha_details
    else:
        # Return the deployment type and None if no HA details are available
        return deployment_type[0], None


def handle_firewall_ha(
    device: Dict,
    dry_run: bool,
) -> Tuple[bool, Optional[Firewall]]:
    """
    Handle the upgrade process for a firewall device in an HA (High Availability) configuration.

    This function checks the HA status of the target device and its peer, and determines the appropriate
    actions to take based on their HA states and software versions. It may suspend the HA state of the
    target device if necessary, and decides whether to proceed with the upgrade or defer it for later.

    Args:
        device (Dict): A dictionary containing information about the target firewall device.
        dry_run (bool): A flag indicating whether to perform a dry run (simulation) or actual changes.

    Returns:
        Tuple[bool, Optional[Firewall]]: A tuple containing two values:
            - bool: True if the upgrade process should proceed, False otherwise.
            - Optional[Firewall]: The peer firewall device object if applicable, None otherwise.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Is target device part of HA?}
            B -->|No| C[Proceed with upgrade]
            B -->|Yes| D[Get HA details]
            D --> E{Are devices synchronized?}
            E -->|No| F[Wait and recheck]
            E -->|Yes| G{Compare software versions}
            G -->|Equal| H{Check local HA state}
            H -->|Active/Active-Primary| I[Defer upgrade]
            H -->|Passive/Active-Secondary| J[Suspend HA state and proceed]
            H -->|Initial| K[Proceed with upgrade]
            G -->|Older| L[Suspend HA state of active and proceed]
            G -->|Newer| M[Suspend HA state of passive and proceed]
        ```
    """

    # If the target device is not part of an HA configuration, proceed with the upgrade
    if not device["db_device"].ha_enabled:
        return True, None

    local_state = device["db_device"].local_state
    local_version = device["db_device"].sw_version

    # Retrieve the HA details from the target device
    peer_device = Device.objects.get(uuid=device["db_device"].peer_device_id)
    peer_version = peer_device.sw_version

    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Local state: {local_state}, Local version: {local_version}, Peer Device: {peer_device.hostname}, Peer version: {peer_version}",
    )

    # Initialize with default values
    max_retries = 3
    retry_interval = 60

    for attempt in range(max_retries):
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Attempt {attempt + 1}/{max_retries} to get HA status.",
        )

        # Re-fetch the HA status to get the latest state
        _, ha_details = get_ha_status(device=device)
        local_version = ha_details["result"]["group"]["local-info"]["build-rel"]
        peer_version = ha_details["result"]["group"]["peer-info"]["build-rel"]

        if ha_details["result"]["group"]["running-sync"] == "synchronized":
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='success')} {device['db_device'].hostname}: HA synchronization complete.",
            )
            break
        else:
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='report')} {device['db_device'].hostname}: HA synchronization still in progress. Rechecking after wait period.",
            )
            # Wait for HA synchronization
            time.sleep(retry_interval)

    version_comparison = compare_versions(
        version1=local_version,
        version2=peer_version,
    )
    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Version comparison: {version_comparison}",
    )

    # If the firewall and its peer devices are running the same version
    if version_comparison == "equal":

        # If the current device is active or active-primary
        if local_state == "active" or local_state == "active-primary":

            # Log message to console
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='search')} {device['db_device'].hostname}: Detected active target device in HA pair running the same version as its peer.",
            )

            # Exit the upgrade process for the target device at this time, to be revisited later
            return False, None

        # If the current device is passive or active-secondary
        elif local_state == "passive" or local_state == "active-secondary":

            # Suspend HA state of the target device
            if not dry_run:
                log_upgrade(
                    level="INFO",
                    message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Suspending HA state of passive or active-secondary",
                )
                suspend_ha_passive(device=device)

            # Log message to console
            else:
                log_upgrade(
                    level="INFO",
                    message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device is passive, but we are in dry-run mode. Skipping HA state suspension.",
                )

            # Continue with upgrade process on the passive target device
            return True, None

        elif local_state == "initial":
            # Continue with upgrade process on the initial target device
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device is in initial HA state",
            )
            return True, None

    elif version_comparison == "older":
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device is on an older version",
        )
        # Suspend HA state of active if the passive is on a later release
        if local_state == "active" or local_state == "active-primary" and not dry_run:
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Suspending HA state of active or active-primary",
            )
            suspend_ha_active(device=device)
        return True, None

    elif version_comparison == "newer":
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device is on a newer version",
        )
        # Suspend HA state of passive if the active is on a later release
        if (
            local_state == "passive"
            or local_state == "active-secondary"  # noqa: W503
            and not dry_run  # noqa: W503
        ):
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Suspending HA state of passive or active-secondary",
            )
            suspend_ha_passive(device=device)
        return True, None

    return False, None


def log_upgrade(
    level: str,
    message: str,
):
    """
    Log an upgrade message with the specified level and additional job details.

    This function logs an upgrade message using the Python logging module. It includes
    additional job details such as the job ID and job type in the log record.

    Args:
        level (str): The logging level for the message (e.g., "INFO", "WARNING", "ERROR").
        message (str): The log message to be recorded.

    Returns:
        None

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Create extra dictionary with job details]
            B --> C[Get the corresponding logging level using getattr]
            C --> D[Log the message with the specified level and extra details]
            D --> E[End]
        ```
    """

    # Create a dictionary with additional job details
    extra = {
        "job_id": JOB_ID,
        "job_type": "upgrade",
    }

    # Log the message with the specified level and extra details
    logger.log(getattr(logging, level), message, extra=extra)


def parse_version(version: str) -> Tuple[int, int, int, int]:
    """
    Parse a version string into its major, minor, maintenance, and hotfix components.

    This function takes a version string in the format "major.minor[.maintenance[-h|-c|-b]hotfix][.xfr]"
    and returns a tuple of four integers representing the major, minor, maintenance, and hotfix parts
    of the version. It handles various version formats and validates the input to ensure it follows
    the expected format.

    Args:
        version (str): The version string to parse.

    Returns:
        Tuple[int, int, int, int]: A tuple containing the major, minor, maintenance, and hotfix
            parts of the version as integers.

    Raises:
        ValueError: If the version string is in an invalid format or contains invalid characters.

    Examples:
        >>> parse_version("10.1.2")
        (10, 1, 2, 0)
        >>> parse_version("10.1.2-h3")
        (10, 1, 2, 3)
        >>> parse_version("10.1.2-c4")
        (10, 1, 2, 4)
        >>> parse_version("10.1.2-b5")
        (10, 1, 2, 5)
        >>> parse_version("10.1.2.xfr")
        (10, 1, 2, 0)
        >>> parse_version("10.1")
        (10, 1, 0, 0)

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Remove .xfr suffix from version string]
            B --> C[Split version string into parts]
            C --> D{Number of parts valid?}
            D -->|No| E[Raise ValueError]
            D -->|Yes| F{Third part contains invalid characters?}
            F -->|Yes| E[Raise ValueError]
            F -->|No| G[Extract major and minor parts]
            G --> H{Length of parts is 3?}
            H -->|No| I[Set maintenance and hotfix to 0]
            H -->|Yes| J[Extract maintenance part]
            J --> K{Maintenance part contains -h, -c, or -b?}
            K -->|Yes| L[Split maintenance part into maintenance and hotfix]
            K -->|No| M[Set hotfix to 0]
            L --> N{Maintenance and hotfix are digits?}
            M --> N{Maintenance and hotfix are digits?}
            N -->|No| E[Raise ValueError]
            N -->|Yes| O[Convert maintenance and hotfix to integers]
            I --> P[Return major, minor, maintenance, hotfix]
            O --> P[Return major, minor, maintenance, hotfix]
        ```
    """
    # Remove .xfr suffix from the version string, keeping the hotfix part intact
    version = re.sub(r"\.xfr$", "", version)

    parts = version.split(".")
    # Ensure there are two or three parts, and if three, the third part does not contain invalid characters like 'h' or 'c' without a preceding '-'
    if (
        len(parts) < 2
        or len(parts) > 3  # noqa: W503
        or (  # noqa: W503
            len(parts) == 3 and re.search(r"[^0-9\-]h|[^0-9\-]c", parts[2])
        )
    ):
        raise ValueError(f"Invalid version format: '{version}'.")

    major, minor = map(int, parts[:2])  # Raises ValueError if conversion fails

    maintenance = 0
    hotfix = 0

    if len(parts) == 3:
        maintenance_part = parts[2]
        if "-h" in maintenance_part:
            maintenance_str, hotfix_str = maintenance_part.split("-h")
        elif "-c" in maintenance_part:
            maintenance_str, hotfix_str = maintenance_part.split("-c")
        elif "-b" in maintenance_part:
            maintenance_str, hotfix_str = maintenance_part.split("-b")
        else:
            maintenance_str = maintenance_part
            hotfix_str = "0"

        # Validate and convert maintenance and hotfix parts
        if not maintenance_str.isdigit() or not hotfix_str.isdigit():
            raise ValueError(
                f"Invalid maintenance or hotfix format in version '{version}'."
            )

        maintenance = int(maintenance_str)
        hotfix = int(hotfix_str)

    return major, minor, maintenance, hotfix


def perform_snapshot(device: Dict) -> any:
    """
    Perform a snapshot of the network state information for a given device.

    This function attempts to take a snapshot of the network state information for a device
    using the run_assurance function. It retries the snapshot operation up to a specified
    maximum number of attempts with a configurable retry interval. If the snapshot is
    successfully created, it is logged and returned. If the snapshot fails after the maximum
    number of attempts, an error is logged.

    Args:
        device (Dict): A dictionary containing information about the device, including the
            device profile and database device object.

    Returns:
        any: The snapshot object if successfully created, or None if the snapshot failed.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Log start of snapshot]
            B --> C{Attempt < Max Attempts and Snapshot is None?}
            C -->|Yes| D[Try to take snapshot using run_assurance]
            D --> E{Snapshot Successful?}
            E -->|Yes| F[Log success and return snapshot]
            E -->|No| G[Log error and wait for retry interval]
            G --> C
            C -->|No| H{Snapshot is None?}
            H -->|Yes| I[Log failure after max attempts]
            H -->|No| J[End]
        ```
    """

    max_snapshot_tries = device["profile"].max_snapshot_tries
    snapshot_retry_interval = device["profile"].snapshot_retry_interval

    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='start')} {device['db_device'].hostname}: Performing snapshot of network state information.",
    )
    attempt = 0
    snapshot = None

    while attempt < max_snapshot_tries and snapshot is None:
        try:
            # Take snapshots
            snapshot = run_assurance(
                device=device,
                operation_type="state_snapshot",
            )

            log_upgrade(
                level="INFO",
                message=snapshot,
            )

        # Catch specific and general exceptions
        except (AttributeError, IOError, Exception) as error:
            log_upgrade(
                level="ERROR",
                message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Snapshot attempt failed with error: {error}. Retrying after {snapshot_retry_interval} seconds.",
            )
            time.sleep(snapshot_retry_interval)
            attempt += 1

    if snapshot is None:
        log_upgrade(
            level="ERROR",
            message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Failed to create snapshot after {max_snapshot_tries} attempts.",
        )

    return snapshot


def run_assurance(
    device: Device,
    operation_type: str,
) -> any:
    """
    Run assurance checks or snapshots on a firewall device.

    This function sets up a FirewallProxy and CheckFirewall instance for the given device,
    and performs assurance operations based on the specified operation_type.

    Args:
        device (Device): A dictionary containing information about the firewall device.
        operation_type (str): The type of assurance operation to perform. Valid values are:
            - "state_snapshot": Take snapshots of various firewall states.

    Returns:
        any: The results of the assurance operation, depending on the operation_type:
            - "state_snapshot": Returns a dictionary containing the snapshot results.
            - Other operation types: Returns None.

    Raises:
        None

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{operation_type?}
            B -->|state_snapshot| C[Set up FirewallProxy and CheckFirewall]
            C --> D[Validate snapshot actions]
            D --> E{Actions valid?}
            E -->|No| F[Log error and return]
            E -->|Yes| G[Take snapshots]
            G --> H{Snapshots successful?}
            H -->|No| I[Log error and return]
            H -->|Yes| J[Log snapshot results and return results]
            B -->|Other| K[Log error and return]
        ```
    """

    # Setup Firewall client
    proxy_firewall = FirewallProxy(device["pan_device"])
    checks_firewall = CheckFirewall(proxy_firewall)
    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Running assurance on firewall {checks_firewall}",
    )

    results = None

    if operation_type == "state_snapshot":
        actions = {
            "arp_table": device["profile"].arp_table_snapshot,
            "content_version": device["profile"].content_version_snapshot,
            "ip_sec_tunnels": device["profile"].ip_sec_tunnels_snapshot,
            "license": device["profile"].license_snapshot,
            "nics": device["profile"].nics_snapshot,
            "routes": device["profile"].routes_snapshot,
            "session_stats": device["profile"].session_stats_snapshot,
        }

        # Validate each type of action
        for action in actions.keys():
            if action not in AssuranceOptions.STATE_SNAPSHOTS.keys():
                log_upgrade(
                    level="ERROR",
                    message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Invalid action for state snapshot: {action}",
                )
                return

        # Take snapshots
        try:
            log_upgrade(
                level="DEBUG",
                message=f"{get_emoji(action='start')} {device['db_device'].hostname}: Performing snapshots.",
            )
            results = checks_firewall.run_snapshots(snapshots_config=actions)
            log_upgrade(
                level="DEBUG",
                message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Snapshot results {results}",
            )

        except Exception as e:
            log_upgrade(
                level="ERROR",
                message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Error running snapshots: {e}",
            )
            return

    else:
        log_upgrade(
            level="ERROR",
            message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Invalid operation type: {operation_type}",
        )
        return

    return results


def software_download(
    device: Dict,
    target_version: str,
) -> bool:
    """
    Download the target software version to the firewall device.

    This function checks if the target software version is already downloaded on the firewall device.
    If the version is not downloaded, it initiates the download process and monitors the download status.
    It logs the progress and status of the download operation.

    Args:
        device (Dict): A dictionary containing information about the firewall device.
        target_version (str): The target software version to be downloaded.

    Returns:
        bool: True if the download is successful, False otherwise.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Is target version already downloaded?}
            B -->|Yes| C[Log success and return True]
            B -->|No| D{Is target version not downloaded or in downloading state?}
            D -->|Yes| E[Log version not found and start download]
            D -->|No| F[Log error and exit]
            E --> G[Initiate download]
            G --> H{Download successful?}
            H -->|Yes| I[Log success and return True]
            H -->|No| J{Download in progress?}
            J -->|Yes| K[Log download progress]
            J -->|No| L[Log download failure and return False]
            K --> M{Download complete?}
            M -->|Yes| I
            M -->|No| K
        ```
    """

    # Check if the target version is already downloaded
    if device["pan_device"].software.versions[target_version]["downloaded"]:
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='success')} {device['db_device'].hostname}: version {target_version} already on target device.",
        )
        return True

    # Check if the target version is not downloaded or in downloading state
    if (
        not device["pan_device"].software.versions[target_version]["downloaded"]
        or device["pan_device"].software.versions[target_version][  # noqa: W503
            "downloaded"
        ]
        != "downloading"  # noqa: W503
    ):
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='search')} {device['db_device'].hostname}: version {target_version} is not on the target device",
        )

        start_time = time.time()

        try:
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='start')} {device['db_device'].hostname}: version {target_version} is beginning download",
            )
            device["pan_device"].software.download(target_version)
        except PanDeviceXapiError as download_error:
            log_upgrade(
                level="ERROR",
                message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Download Error {download_error}",
            )

            sys.exit(1)

        while True:
            device["pan_device"].software.info()
            dl_status = device["pan_device"].software.versions[target_version][
                "downloaded"
            ]
            elapsed_time = int(time.time() - start_time)

            if dl_status is True:
                log_upgrade(
                    level="INFO",
                    message=f"{get_emoji(action='success')} {device['db_device'].hostname}: {target_version} downloaded in {elapsed_time} seconds",
                )
                return True
            elif dl_status in (False, "downloading"):
                # Consolidate logging for both 'False' and 'downloading' states
                status_msg = (
                    "Download is starting"
                    if dl_status is False
                    else f"Downloading version {target_version}"
                )
                if device["db_device"].ha_enabled:
                    log_upgrade(
                        level="INFO",
                        message=f"{get_emoji(action='working')} {device['db_device'].hostname}: {status_msg} - Elapsed time: {elapsed_time} seconds",
                    )
                else:
                    log_upgrade(
                        level="INFO",
                        message=f"{get_emoji(action='working')} {device['db_device'].hostname}: {status_msg} - Elapsed time: {elapsed_time} seconds",
                    )
            else:
                log_upgrade(
                    level="ERROR",
                    message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Download failed after {elapsed_time} seconds",
                )
                return False

            time.sleep(30)

    else:
        log_upgrade(
            level="ERROR",
            message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Error downloading {target_version}.",
        )

        sys.exit(1)


def software_update_check(
    device: Dict,
    target_version: str,
) -> bool:
    """
    Check if a software update to the target version is available and compatible.

    This function performs the following steps:
    1. Parses the target version into major, minor, and maintenance components.
    2. Checks if the target version is older than the current version.
    3. Verifies the compatibility of the target version with the current version and HA setup.
    4. Retrieves the list of available software versions from the device.
    5. If the target version is available, attempts to download the base image.
    6. If the base image is already downloaded or successfully downloaded, returns True.
    7. If the target version is not available or the download fails after multiple attempts, returns False.

    Args:
        device (Dict): A dictionary containing information about the firewall device.
        target_version (str): The target software version to check for availability and compatibility.

    Returns:
        bool: True if the target version is available and compatible, False otherwise.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Parse target version]
            B --> C[Check if target version is older than current version]
            C --> D[Verify compatibility with current version and HA setup]
            D --> E{Compatible?}
            E -->|No| F[Return False]
            E -->|Yes| G[Retrieve available software versions]
            G --> H{Target version available?}
            H -->|No| I[Return False]
            H -->|Yes| J{Base image downloaded?}
            J -->|Yes| K[Return True]
            J -->|No| L[Attempt base image download]
            L --> M{Download successful?}
            M -->|Yes| N[Wait for image to load]
            N --> O[Re-check available versions]
            O --> P{Target version available?}
            P -->|Yes| Q[Return True]
            P -->|No| R{Retry count exceeded?}
            R -->|No| S[Retry download]
            S --> L
            R -->|Yes| T[Return False]
            M -->|No| U{Retry count exceeded?}
            U -->|No| V[Wait and retry download]
            V --> L
            U -->|Yes| W[Return False]
        ```
    """

    # Parse target_version into major, minor, and maintenance components
    target_major, target_minor, target_maintenance = target_version.split(".")

    # Convert target_major and target_minor to integers
    target_major = int(target_major)
    target_minor = int(target_minor)

    # Check if target_maintenance can be converted to an integer
    if target_maintenance.isdigit():
        # Convert target_maintenance to integer
        target_maintenance = int(target_maintenance)

    # Check if the specified version is older than the current version
    determine_upgrade(
        device=device,
        target_maintenance=target_maintenance,
        target_major=target_major,
        target_minor=target_minor,
    )

    current_parts = device["db_device"].sw_version.split(".")
    current_major, current_minor = map(int, current_parts[:2])

    # Check if the target version is compatible with the current version and the HA setup
    if not check_ha_compatibility(
        device=device,
        current_major=current_major,
        current_minor=current_minor,
        target_major=target_major,
        target_minor=target_minor,
    ):
        return False

    # Retrieve available versions of PAN-OS
    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='working')} {device['db_device'].hostname}: Refreshing list of available software versions",
    )
    device["pan_device"].software.check()
    available_versions = device["pan_device"].software.versions

    if target_version in available_versions:
        retry_count = device["profile"].max_download_tries
        wait_time = device["profile"].download_retry_interval

        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Version {target_version} is available for download",
        )

        base_version_key = f"{target_major}.{target_minor}.0"
        if available_versions.get(base_version_key, {}).get("downloaded"):
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='success')} {device['db_device'].hostname}: Base image for {target_version} is already downloaded",
            )
            return True
        else:
            for attempt in range(retry_count):
                log_upgrade(
                    level="INFO",
                    message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Base image for {target_version} is not downloaded. Attempting download.",
                )
                downloaded = software_download(
                    device=device,
                    target_version=target_version,
                )

                if downloaded:
                    log_upgrade(
                        level="INFO",
                        message=f"{get_emoji(action='success')} {device['db_device'].hostname}: Base image {base_version_key} downloaded successfully",
                    )
                    log_upgrade(
                        level="INFO",
                        message=f"{get_emoji(action='success')} {device['db_device'].hostname}: Pausing for {wait_time} seconds to let {base_version_key} image load into the software manager before downloading {target_version}",
                    )

                    # Wait before retrying to ensure the device has processed the downloaded base image
                    time.sleep(wait_time)

                    # Re-check the versions after waiting
                    device["pan_device"].software.check()
                    if target_version in device["pan_device"].software.versions:
                        # Proceed with the target version check again
                        return software_update_check(
                            device=device,
                            target_version=target_version,
                        )

                    else:
                        log_upgrade(
                            level="INFO",
                            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Waiting for device to load the new base image into software manager",
                        )
                        # Retry if the version is still not recognized
                        continue
                else:
                    if attempt < retry_count - 1:
                        log_upgrade(
                            level="INFO",
                            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Failed to download base image for version {target_version}. Retrying in {wait_time} seconds.",
                        )
                        time.sleep(wait_time)
                    else:
                        log_upgrade(
                            level="ERROR",
                            message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Failed to download base image after {retry_count} attempts.",
                        )
                        return False

    else:
        return False


def suspend_ha_active(device: Dict) -> bool:
    """
    Suspend the active device in a high-availability (HA) pair.

    This function sends an API request to the active device in an HA pair to suspend its state.
    It parses the XML response to determine if the suspension was successful.

    Args:
        device (Dict): A dictionary containing information about the firewall device.
            The dictionary should include the following keys:
            - "pan_device": A PanDevice object representing the firewall device.
            - "db_device": An object representing the device in the database, with a "hostname" attribute.

    Returns:
        bool: True if the active device was successfully suspended, False otherwise.

    Raises:
        Exception: If an error occurs while suspending the active device.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Send API request to suspend active device]
            B --> C{Parse XML response}
            C -->|Success| D[Log success message and return True]
            C -->|Failure| E[Log failure message and return False]
            B --> F[Catch exception]
            F --> G[Log error message and return False]
        ```
    """

    try:
        # Send API request to suspend the active device
        suspension_response = device["pan_device"].op(
            "<request><high-availability><state><suspend/></state></high-availability></request>",
            cmd_xml=False,
        )

        # Parse the XML response to extract the result message
        response_message = flatten_xml_to_dict(suspension_response)

        # Check if the suspension was successful
        if response_message["result"] == "Successfully changed HA state to suspended":
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='success')} {device['db_device'].hostname}: Active target device HA state suspended.",
            )
            return True
        else:
            log_upgrade(
                level="ERROR",
                message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Failed to suspend active target device HA state.",
            )
            return False
    except Exception as e:
        log_upgrade(
            level="ERROR",
            message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Error suspending active target device HA state: {e}",
        )
        return False


def suspend_ha_passive(device: Dict) -> bool:
    """
    Suspend the HA state of the passive target device in an HA pair.

    This function sends a request to suspend the HA state of the passive target device in an HA pair.
    It logs the start and success/failure of the suspension process.

    Args:
        device (Dict): A dictionary containing information about the firewall device, including the 'db_device' and 'pan_device' keys.
            - 'db_device' should contain the hostname of the device.
            - 'pan_device' should be an instance of the PanDevice class representing the firewall device.

    Returns:
        bool: True if the HA state is successfully suspended, False otherwise.

    Raises:
        Exception: If an error occurs while suspending the HA state.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Log start of HA state suspension]
            B --> C[Send request to suspend HA state]
            C --> D{Suspension successful?}
            D -->|Yes| E[Log success and return True]
            D -->|No| F[Log failure and return False]
            C --> G[Catch exception]
            G --> H[Log error and return False]
        ```
    """

    # Log the start of HA state suspension
    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='start')} {device['db_device'].hostname}: Suspending passive target device HA state.",
    )

    try:
        # Send a request to suspend the HA state
        suspension_response = device["pan_device"].op(
            "<request><high-availability><state><suspend/></state></high-availability></request>",
            cmd_xml=False,
        )

        # Parse the response message
        response_message = flatten_xml_to_dict(suspension_response)

        # Check if the HA state suspension was successful
        if response_message["result"] == "Successfully changed HA state to suspended":
            # Log the success of HA state suspension
            log_upgrade(
                level="INFO",
                message=f"{get_emoji(action='success')} {device['db_device'].hostname}: Passive target device HA state suspended.",
            )
            return True
        else:
            # Log the failure of HA state suspension
            log_upgrade(
                level="ERROR",
                message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Failed to suspend passive target device HA state.",
            )
            return False
    except Exception as e:
        # Log any errors that occur during HA state suspension
        log_upgrade(
            level="ERROR",
            message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Error suspending passive target device HA state: {e}",
        )
        return False


def upgrade_firewall(
    device: Dict,
    dry_run: bool,
    target_version: str,
) -> None:
    """
    Upgrade a firewall to a target PAN-OS version.

    This function performs the necessary steps to upgrade a firewall to a target PAN-OS version.
    It checks if the firewall is ready for an upgrade, handles HA scenarios, downloads the target
    version, performs pre-upgrade snapshots, and initiates the upgrade process.

    Args:
        device (Dict): A dictionary containing information about the firewall device.
        dry_run (bool): Indicates whether to perform a dry run (True) or actual upgrade (False).
        target_version (str): The target PAN-OS version to upgrade to.

    Returns:
        None

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Check if upgrade is available}
            B -->|No| C[Log error and exit]
            B -->|Yes| D{Is firewall part of HA pair?}
            D -->|Yes| E{Determine active/passive role}
            E -->|Not ready| F[Switch control to peer firewall]
            E -->|Ready| G[Proceed with upgrade]
            D -->|No| G[Proceed with upgrade]
            G --> H{Is target version already downloaded?}
            H -->|Yes| I[Log success]
            H -->|No| J[Download target version]
            J -->|Success| I[Log success]
            J -->|Failure| K[Log error and exit]
            I --> L[Perform pre-upgrade snapshot]
            L --> M[Perform upgrade]
            M -->|Success| N[Perform post-upgrade tasks]
            M -->|Failure| O[Log error]
            N --> P[End]
            O --> P[End]
        ```
    """

    # Check to see if the firewall is ready for an upgrade
    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Checking to see if a PAN-OS upgrade is available.",
    )

    update_available = software_update_check(
        device=device,
        target_version=target_version,
    )

    # Gracefully exit if the firewall is not ready for an upgrade to target version
    if not update_available:
        log_upgrade(
            level="ERROR",
            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Not ready for upgrade to {target_version}.",
        )
        sys.exit(1)

    # If firewall is part of HA pair, determine if it's active or passive
    if device["db_device"].ha_enabled:
        proceed_with_upgrade, peer_firewall = handle_firewall_ha(
            device=device,
            dry_run=dry_run,
        )

        # Gracefully exit the upgrade_firewall function if the firewall is not ready for an upgrade to target version
        if not proceed_with_upgrade:
            if peer_firewall:
                log_upgrade(
                    level="INFO",
                    message=f"{get_emoji(action='start')} {device['db_device'].hostname}: Switching control to the peer firewall for upgrade.",
                )
                upgrade_firewall(
                    device=peer_firewall,
                    dry_run=dry_run,
                    target_version=target_version,
                )
            else:
                return  # Exit the function without proceeding to upgrade

    # Download the target version
    log_upgrade(
        level="INFO",
        message=f"{get_emoji(action='start')} {device['db_device'].hostname}: Performing test to see if {target_version} is already downloaded.",
    )

    image_downloaded = software_download(
        device=device,
        target_version=target_version,
    )

    if device["db_device"].ha_enabled and image_downloaded:
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='success')} {device['db_device'].hostname}: {target_version} has been downloaded and sync'd to HA peer.",
        )
    elif image_downloaded:
        log_upgrade(
            level="INFO",
            message=f"{get_emoji(action='success')} {device['db_device'].hostname}: version {target_version} has been downloaded.",
        )
    else:
        log_upgrade(
            level="ERROR",
            message=f"{get_emoji(action='error')} {device['db_device'].hostname}: Image not downloaded, exiting.",
        )
        sys.exit(1)

    # Perform the pre-upgrade snapshot
    pre_snapshot = perform_snapshot(device=device)

    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Pre-upgrade snapshot {pre_snapshot}",
    )

    # TODO: Implement the remaining upgrade steps
    # - Perform readiness checks
    # - Perform HA sync check for HA firewalls
    # - Back up configuration to local filesystem
    # - Exit execution if dry_run is True
    # - Perform the upgrade
    # - Perform post-upgrade tasks (reboot, post-upgrade snapshot, generate diff report)

    # # Perform Readiness Checks
    # perform_readiness_checks(
    #     file_path=f'assurance/readiness_checks/{hostname}/pre/{time.strftime("%Y-%m-%d_%H-%M-%S")}.json',
    #     firewall=firewall,
    #     hostname=hostname,
    #     readiness_checks_location=profile.readiness_checks_location,
    # )

    # # Perform HA sync check, skipping standalone firewalls
    # if ha_details:
    #     ha_sync_check_firewall(
    #         ha_details=ha_details,
    #         hostname=hostname,
    #     )

    # # Back up configuration to local filesystem
    # logging.info(
    #     f"{get_emoji(action='start')} {hostname}: Performing backup of configuration to local filesystem."
    # )
    # backup_config = backup_configuration(
    #     file_path=f'assurance/configurations/{hostname}/pre/{time.strftime("%Y-%m-%d_%H-%M-%S")}.xml',
    #     hostname=hostname,
    #     target_device=firewall,
    # )
    # logging.debug(f"{get_emoji(action='report')} {hostname}: {backup_config}")

    # # Exit execution is dry_run is True
    # if dry_run is True:
    #     logging.info(
    #         f"{get_emoji(action='success')} {hostname}: Dry run complete, exiting."
    #     )
    #     logging.info(f"{get_emoji(action='stop')} {hostname}: Halting script.")
    #     sys.exit(0)
    # else:
    #     logging.info(
    #         f"{get_emoji(action='report')} {hostname}: Not a dry run, continue with upgrade."
    #     )

    # # Perform the upgrade
    # install_success = perform_upgrade(
    #     hostname=hostname,
    #     profile=profile,
    #     target_device=firewall,
    #     target_version=target_version,
    # )

    # # Perform the reboot if the installation was successful
    # if install_success:
    #     perform_reboot(
    #         hostname=hostname,
    #         profile=profile,
    #         target_device=firewall,
    #         target_version=target_version,
    #     )

    #     # Back up configuration to local filesystem
    #     logging.info(
    #         f"{get_emoji(action='start')} {hostname}: Performing backup of configuration to local filesystem."
    #     )
    #     backup_config = backup_configuration(
    #         file_path=f'assurance/configurations/{hostname}/post/{time.strftime("%Y-%m-%d_%H-%M-%S")}.xml',
    #         hostname=hostname,
    #         target_device=firewall,
    #     )
    #     logging.debug(f"{get_emoji(action='report')} {hostname}: {backup_config}")

    #     # Wait for the device to become ready for the post upgrade snapshot
    #     logging.info(
    #         f"{get_emoji(action='working')} {hostname}: Waiting for the device to become ready for the post upgrade snapshot."
    #     )
    #     time.sleep(120)

    #     # Perform the post-upgrade snapshot
    #     post_snapshot = perform_snapshot(
    #         actions=selected_actions,
    #         file_path=f'assurance/snapshots/{hostname}/post/{time.strftime("%Y-%m-%d_%H-%M-%S")}.json',
    #         firewall=firewall,
    #         hostname=hostname,
    #         snapshots_location=profile.snapshots_location,
    #     )

    #     # initialize object storing both snapshots
    #     snapshot_compare = SnapshotCompare(
    #         left_snapshot=pre_snapshot.model_dump(),
    #         right_snapshot=post_snapshot.model_dump(),
    #     )

    #     pre_post_diff = snapshot_compare.compare_snapshots(selected_actions)

    #     logging.debug(
    #         f"{get_emoji(action='report')} {hostname}: Snapshot comparison before and after upgrade {pre_post_diff}"
    #     )

    #     folder_path = f"assurance/snapshots/{hostname}/diff"
    #     pdf_report = f'{folder_path}/{time.strftime("%Y-%m-%d_%H-%M-%S")}_report.pdf'
    #     ensure_directory_exists(file_path=pdf_report)

    #     # Generate the PDF report for the diff
    #     generate_diff_report_pdf(
    #         file_path=pdf_report,
    #         hostname=hostname,
    #         pre_post_diff=pre_post_diff,
    #         target_version=target_version,
    #     )

    #     logging.info(
    #         f"{get_emoji(action='save')} {hostname}: Snapshot comparison PDF report saved to {pdf_report}"
    #     )

    #     json_report = f'{folder_path}/{time.strftime("%Y-%m-%d_%H-%M-%S")}_report.json'

    #     # Write the file to the local filesystem as JSON
    #     with open(json_report, "w") as file:
    #         file.write(json.dumps(pre_post_diff))

    #     logging.debug(
    #         f"{get_emoji(action='save')} {hostname}: Snapshot comparison JSON report saved to {json_report}"
    #     )

    # else:
    #     logging.error(
    #         f"{get_emoji(action='error')} {hostname}: Installation of the target version was not successful. Skipping reboot."
    #     )


def run_panos_upgrade(
    author_id: int,
    device_uuid: str,
    dry_run: bool,
    job_id: str,
    profile_uuid: str,
    target_version: str,
) -> str:
    """
    Runs the PAN-OS upgrade process for a specified device.

    This function performs the PAN-OS upgrade workflow for a given device. It retrieves the device
    and profile information from the database, creates Firewall objects for the device and its HA peer
    (if applicable), and executes the upgrade process. The upgrade is performed in two rounds:
    first targeting passive and active-secondary firewalls, and then targeting active and active-primary firewalls.

    Args:
        author_id (int): The ID of the author performing the upgrade.
        device_uuid (str): The UUID of the device to upgrade.
        dry_run (bool): Indicates whether to perform a dry run without making any changes.
        job_id (str): The ID of the job associated with the upgrade.
        profile_uuid (str): The UUID of the profile to use for authentication.
        target_version (str): The target PAN-OS version for the upgrade.

    Returns:
        str: A JSON string indicating the execution status of the upgrade workflow.

    Raises:
        Exception: If an error occurs during the PAN-OS upgrade process.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Set global JOB_ID]
            B --> C[Log upgrade details]
            C --> D[Retrieve Device and Profile from database]
            D --> E{Device panorama managed?}
            E -->|Yes| F[Create Firewall object with serial and Panorama]
            E -->|No| G[Create Firewall object with IP address]
            F --> H[Create device dictionary object]
            G --> H
            H --> I[Add device to upgrade_devices list]
            I --> J{Device in HA pair?}
            J -->|Yes| K[Create Firewall object for HA peer]
            J -->|No| L[Iterate over passive and active-secondary devices]
            K --> L
            L --> M[Upgrade passive and active-secondary firewalls]
            M --> N[Iterate over active and active-primary devices]
            N --> O[Upgrade active and active-primary firewalls]
            O --> P[Return JSON output]
            P --> Q[End]
        ```
    """
    global JOB_ID
    JOB_ID = job_id

    # Check to see if the firewall is ready for an upgrade
    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='report')} Running PAN-OS upgrade for device: {device_uuid}",
    )
    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='report')} Author ID: {author_id}",
    )
    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='report')} Using profile: {profile_uuid}",
    )
    log_upgrade(
        level="DEBUG",
        message=f"{get_emoji(action='report')} Target PAN-OS version: {target_version}",
    )

    upgrade_devices = []

    try:
        # Retrieve the Device and Profile objects from the database
        device = Device.objects.get(uuid=device_uuid)
        profile = Profile.objects.get(uuid=profile_uuid)

        # Perform common setup tasks, return a connected device
        if device.panorama_managed:
            # Create a Firewall object using the serial and Panorama if the device is Panorama-managed
            firewall = Firewall(
                serial=device.serial,
                api_username=profile.pan_username,
                api_password=profile.pan_password,
            )
            pan = Panorama(
                hostname=(
                    device.panorama_ipv4_address
                    if device.panorama_ipv4_address
                    else device.ipv6_address
                ),
                api_username=profile.pan_username,
                api_password=profile.pan_password,
            )
            pan.add(firewall)
        else:
            # Create a Firewall object using the IP address if the device is not Panorama-managed
            firewall = Firewall(
                hostname=device.ipv4_address,
                username=profile.pan_username,
                password=profile.pan_password,
            )

        # Create a dictionary object to store the device, firewall, and profile objects
        device = {
            "db_device": device,
            "job_id": JOB_ID,
            "pan_device": firewall,
            "profile": profile,
        }
        log_upgrade(
            level="DEBUG",
            message=f"{get_emoji(action='report')} {device['db_device'].hostname}: Device and firewall objects created.",
        )

        # Add the device object to the upgrade_devices list
        upgrade_devices.append(device)

        # If the device is in an HA pair, create a Firewall object for the peer device
        if upgrade_devices[0]["db_device"].ha_enabled:
            # Create a Firewall object based on HA peer information within device object.
            if upgrade_devices[0]["db_device"].peer_device is not None:
                peer = Device.objects.get(
                    pk=upgrade_devices[0]["db_device"].peer_device.pk
                )

                # If the device is managed by Panorama, use the serial instead of the IP address
                if upgrade_devices[0]["db_device"].panorama_managed:
                    peer_firewall = Firewall(
                        serial=peer.serial,
                        api_username=upgrade_devices[0]["profile"].pan_username,
                        api_password=upgrade_devices[0]["profile"].pan_password,
                    )
                    pan = Panorama(
                        hostname=peer.panorama_ipv4_address,
                        api_username=upgrade_devices[0]["profile"].pan_username,
                        api_password=upgrade_devices[0]["profile"].pan_password,
                    )
                    pan.add(peer_firewall)
                else:
                    peer_firewall = Firewall(
                        hostname=peer.ipv4_address,
                        api_username=upgrade_devices[0]["profile"].pan_username,
                        api_password=upgrade_devices[0]["profile"].pan_password,
                    )

                # Create another instance of device object for the peer device
                upgrade_devices.append(
                    {
                        "db_device": peer,
                        "pan_device": peer_firewall,
                        "profile": upgrade_devices[0]["profile"],
                    }
                )

                log_upgrade(
                    level="INFO",
                    message=f"{get_emoji(action='report')} {upgrade_devices[0]['db_device'].hostname}: HA peer firewall added to the upgrade list.",
                )

        # Iterate over the list of passive and active-secondary devices to upgrade
        for each in upgrade_devices:
            # First round of upgrades, targeting passive and active-secondary firewalls
            if each["db_device"].local_state in [
                "passive",
                "active-secondary",
            ]:
                try:
                    upgrade_firewall(
                        device=each,
                        dry_run=dry_run,
                        target_version=target_version,
                    )
                except Exception as exc:
                    log_upgrade(
                        level="ERROR",
                        message=f"{get_emoji(action='error')} {each['db_device'].hostname}: Generated an exception: {exc}",
                    )

        # Iterate over the list of devices to upgrade
        for each in upgrade_devices:
            # Second round of upgrades, targeting active and active-primary firewalls
            if each["db_device"].local_state in [
                "active",
                "active-primary",
            ]:
                try:
                    upgrade_firewall(
                        device=each,
                        dry_run=dry_run,
                        target_version=target_version,
                    )
                except Exception as exc:
                    log_upgrade(
                        level="ERROR",
                        message=f"{get_emoji(action='error')} {each['db_device'].hostname}: Generated an exception: {exc}",
                    )

        # Return the JSON output indicating the execution status
        json_output = json.dumps(
            {
                "exec": "upgrade workflow executed",
                "device": f"{each['db_device'].hostname}",
            }
        )
        return json_output

    except Exception as e:
        log_upgrade(
            level="ERROR",
            message=f"{get_emoji(action='error')} Error during PAN-OS upgrade: {str(e)}",
        )
        raise e


if __name__ == "__main__":
    """
    Main entry point for the PAN-OS upgrade script.

    This script is used to run the PAN-OS upgrade process for Palo Alto Networks devices.
    It parses command-line arguments, configures logging, creates a new job entry, and
    initiates the upgrade process by calling the `run_panos_upgrade` function.

    Command-line arguments:
        -d, --device-uuid (str): UUID of the device to upgrade (required).
        -a, --author-id (int): ID of the author performing the upgrade (required).
        --dry-run: Perform a dry run without making any changes (optional).
        -l, --log-level (str): Set the logging level (default: INFO) (optional).
        -p, --profile-uuid (str): UUID of the profile to use for authentication (required).
        -t, --target-version (str): Target PAN-OS version for the upgrade (required).

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Parse command-line arguments]
            B --> C[Configure logging level]
            C --> D[Create a new Job entry]
            D --> E[Call run_panos_upgrade function]
            E --> F[End]
        ```
    """

    parser = argparse.ArgumentParser(
        description="Run PAN-OS upgrade script for Palo Alto Networks devices"
    )
    parser.add_argument(
        "-d",
        "--device-uuid",
        type=str,
        required=True,
        help="UUID of the device to upgrade",
    )
    parser.add_argument(
        "-a",
        "--author-id",
        type=int,
        required=True,
        help="ID of the author performing the upgrade",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Perform a dry run without making any changes",
    )
    parser.add_argument(
        "-l",
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Set the logging level (default: INFO)",
    )
    parser.add_argument(
        "-p",
        "--profile-uuid",
        type=str,
        required=True,
        help="UUID of the profile to use for authentication",
    )
    parser.add_argument(
        "-t",
        "--target-version",
        type=str,
        required=True,
        help="Target PAN-OS version for the upgrade",
    )

    args = parser.parse_args()

    # Configure logging level
    logging.basicConfig(level=args.log_level)

    device_uuid = args.device_uuid
    author_id = args.author_id
    profile_uuid = args.profile_uuid
    target_version = args.target_version
    dry_run = args.dry_run

    # Create a new Job entry
    author = get_user_model().objects.get(id=author_id)
    job = Job.objects.create(
        job_type="device_upgrade",
        json_data=None,
        author=author,
        task_id=str(uuid.uuid4()),
    )

    # Initiate the upgrade process
    run_panos_upgrade(
        author_id=author_id,
        device_uuid=device_uuid,
        dry_run=dry_run,
        job_id=str(job.task_id),
        profile_uuid=profile_uuid,
        target_version=target_version,
    )
