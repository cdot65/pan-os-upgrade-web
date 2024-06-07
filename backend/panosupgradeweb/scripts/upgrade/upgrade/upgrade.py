import re
import time
from typing import Dict, List, Optional, Tuple, Union

from celery.exceptions import WorkerLostError

# Palo Alto Networks SDK imports
from panos.errors import PanDeviceXapiError
from panos.firewall import Firewall
from panos.panorama import Panorama

# Palo Alto Networks Assurance imports
from panos_upgrade_assurance.check_firewall import CheckFirewall
from panos_upgrade_assurance.firewall_proxy import FirewallProxy

# project imports
from panosupgradeweb.models import Device, Profile
from pan_os_upgrade.components.utilities import flatten_xml_to_dict
from pan_os_upgrade.components.assurance import AssuranceOptions

from .upgrade_logger import UpgradeLogger

class PanosUpgrade:
    """
    A class to handle the PAN-OS upgrade process for Palo Alto Networks devices.

    This class provides methods to perform various tasks related to upgrading PAN-OS devices,
    such as checking version compatibility, preparing upgrade devices, upgrading passive and
    active devices, and handling HA scenarios.

    Attributes:
        job_id (str): The ID of the job associated with the upgrade.
        logger (UpgradeLogger): An instance of the UpgradeLogger class for logging upgrade-related messages.
        upgrade_devices (List[Dict]): A list of dictionaries containing information about the devices to be upgraded.

    Methods:
        check_ha_compatibility: Check the compatibility of upgrading a firewall in an HA pair to a target version.
        compare_versions: Compare two version strings and determine their relative order.
        determine_upgrade: Determine if a firewall requires an upgrade based on the current and target versions.
        get_ha_status: Retrieve the deployment information and HA status of a firewall device.
        handle_firewall_ha: Handle the upgrade process for a firewall device in an HA configuration.
        parse_version: Parse a version string into its major, minor, maintenance, and hotfix components.
        perform_snapshot: Perform a snapshot of the network state information for a given device.
        each: Prepare the upgrade devices by creating device and firewall objects.
        run_assurance: Run assurance checks or snapshots on a firewall device.
        run_upgrade: Orchestrate the upgrade process by calling the appropriate methods based on the device state.
        software_download: Download the target software version to the firewall device.
        software_available_check: Check if a software update to the target version is available and compatible.
        suspend_ha_device: Suspend the active device in a high-availability (HA) pair.
        upgrade_active_devices: Upgrade the active devices in the upgrade_devices list.
        upgrade_firewall: Upgrade a firewall to a target PAN-OS version.
        upgrade_passive_devices: Upgrade the passive devices in the upgrade_devices list.
    """

    def __init__(
            self,
            job_id: str,
    ):
        self.job_id = job_id
        self.logger = UpgradeLogger("pan-os-upgrade-upgrade")
        self.logger.set_job_id(job_id)
        self.upgrade_devices = []

    def check_ha_compatibility(
            self,
            current_version: Tuple[int, int, int, int],
            device: Dict,
            target_version: Tuple[int, int, int, int],
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
        if target_version[0] - current_version[0] > 1:
            self.logger.log_task(
                action="warning",
                message=f"{device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that is more than one major release apart may cause compatibility issues.",
            )
            return False

        # Check if the upgrade is within the same major version but the minor upgrade is more than one release apart
        elif (
                target_version[0] == current_version[0]
                and target_version[1] - current_version[1] > 1
        ):
            self.logger.log_task(
                action="warning",
                message=f"{device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that is more than one minor release apart may cause compatibility issues.",
            )
            return False

        # Check if the upgrade spans exactly one major version but also increases the minor version
        elif target_version[0] - current_version[0] == 1 and target_version[1] > 0:
            self.logger.log_task(
                action="warning",
                message=f"{device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that spans more than one major release or increases the minor version beyond the first in the next major release may cause compatibility issues.",
            )
            return False

        # Log compatibility check success
        self.logger.log_task(
            action="success",
            message=f"{device['db_device'].hostname}: The target version is compatible with the current version.",
        )
        return True

    def compare_versions(
            self,
            local_version_sliced: Tuple[int, int, int, int],
            device: Dict,
            peer_version_sliced: Tuple[int, int, int, int],
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
        self.logger.log_task(
            action="search",
            message=f"{device['db_device'].hostname}: Comparing version strings",
        )

        # Compare the local and peer versions and return the relative order
        if local_version_sliced < peer_version_sliced:
            return "older"
        elif local_version_sliced > peer_version_sliced:
            return "newer"
        else:
            return "equal"

    def determine_upgrade(
            self,
            device: Dict,
            current_version: Tuple[int, int, int, int],
            target_version: Tuple[int, int, int, int],
    ) -> bool:
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

        # Log the current and target versions
        self.logger.log_task(
            action="report",
            message=f"{device['db_device'].hostname}: Current version: {current_version}.",
        )
        self.logger.log_task(
            action="report",
            message=f"{device['db_device'].hostname}: Target version: {target_version}.",
        )

        if current_version < target_version:
            # Log upgrade required message if the current version is less than the target version
            self.logger.log_task(
                action="start",
                message=f"{device['db_device'].hostname}: Upgrade required from {current_version} to {target_version}",
            )
            return True

        else:
            # Log no upgrade required or downgrade attempt detected message
            self.logger.log_task(
                action="skipped",
                message=f"{device['db_device'].hostname}: No upgrade required or downgrade attempt detected.",
            )
            # Log halting upgrade message and exit the script
            self.logger.log_task(
                action="stop",
                message=f"{device['db_device'].hostname}: Halting upgrade.",
            )
            return False

    def get_ha_status(
            self,
            device: Dict,
    ) -> Optional[dict]:
        """
        Retrieve the deployment information and HA status of a firewall device.

        This function uses the `show_highavailability_state()` method to retrieve the deployment type
        and HA details of the specified firewall device. It logs the progress and results of the operation
        using the `self.logger.log_task()` function.

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
        self.logger.log_task(
            action="start",
            message=f"{device['db_device'].hostname}: Getting {device['pan_device'].serial} deployment information.",
        )

        # Get the deployment type using show_highavailability_state()
        deployment_type = device["pan_device"].show_highavailability_state()

        # Log the target device deployment type
        self.logger.log_task(
            action="report",
            message=f"{device['db_device'].hostname}: Target device deployment: {deployment_type[0]}",
        )

        # Check if HA details are available
        if deployment_type[1]:

            # Flatten the XML to a dictionary if HA details are available
            ha_details = flatten_xml_to_dict(element=deployment_type[1])

            # Log that the target device deployment details have been collected
            self.logger.log_task(
                action="success",
                message=f"{device['db_device'].hostname}: Target device deployment details collected.",
            )

            # Return the HA details if available
            return ha_details

        # If no HA details are available, log the deployment type and return None
        else:
            self.logger.log_task(
                action="report",
                message=f"{device['db_device'].hostname}: No HA details available.",
            )
            return None

    def parse_version(
            self,
            version: str,
    ) -> Tuple[int, int, int, int]:
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
                or len(parts) > 3
                or (len(parts) == 3 and re.search(r"[^0-9\-]h|[^0-9\-]c", parts[2]))
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

    def create_list_of_upgrade_devices(
            self,
            device_uuid: str,
            profile_uuid: str,
    ) -> None:

        device = Device.objects.get(uuid=device_uuid)
        profile = Profile.objects.get(uuid=profile_uuid)

        if device.panorama_managed:
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
            firewall = Firewall(
                hostname=device.ipv4_address,
                username=profile.pan_username,
                password=profile.pan_password,
            )

        device = {
            "db_device": device,
            "job_id": self.job_id,
            "pan_device": firewall,
            "profile": profile,
        }
        self.logger.log_task(
            action="report",
            message=f"{device['db_device'].hostname}: Device and firewall objects created.",
        )

        self.upgrade_devices.append(device)

        if self.upgrade_devices[0]["db_device"].ha_enabled:
            if self.upgrade_devices[0]["db_device"].peer_device is not None:
                peer = Device.objects.get(
                    pk=self.upgrade_devices[0]["db_device"].peer_device.pk
                )

                if self.upgrade_devices[0]["db_device"].panorama_managed:
                    peer_firewall = Firewall(
                        serial=peer.serial,
                        api_username=self.upgrade_devices[0]["profile"].pan_username,
                        api_password=self.upgrade_devices[0]["profile"].pan_password,
                    )
                    pan = Panorama(
                        hostname=peer.panorama_ipv4_address,
                        api_username=self.upgrade_devices[0]["profile"].pan_username,
                        api_password=self.upgrade_devices[0]["profile"].pan_password,
                    )
                    pan.add(peer_firewall)
                else:
                    peer_firewall = Firewall(
                        hostname=peer.ipv4_address,
                        api_username=self.upgrade_devices[0]["profile"].pan_username,
                        api_password=self.upgrade_devices[0]["profile"].pan_password,
                    )

                self.upgrade_devices.append(
                    {
                        "db_device": peer,
                        "job_id": self.job_id,
                        "pan_device": peer_firewall,
                        "profile": self.upgrade_devices[0]["profile"],
                    }
                )
                self.logger.log_task(
                    action="report",
                    message=f"{self.upgrade_devices[0]['db_device'].hostname}: HA peer firewall added to the upgrade list.",
                )

    def run_assurance(
            self,
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
        self.logger.log_task(
            action="report",
            message=f"{device['db_device'].hostname}: Running assurance on firewall {checks_firewall}",
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
                    self.logger.log_task(
                        action="error",
                        message=f"{device['db_device'].hostname}: Invalid action for state snapshot: {action}",
                    )
                    return

            # Take snapshots
            try:
                self.logger.log_task(
                    action="start",
                    message=f"{device['db_device'].hostname}: Performing snapshots.",
                )
                results = checks_firewall.run_snapshots(snapshots_config=actions)
                self.logger.log_task(
                    action="report",
                    message=f"{device['db_device'].hostname}: Snapshot results {results}",
                )

            except Exception as e:
                self.logger.log_task(
                    action="error",
                    message=f"{device['db_device'].hostname}: Error running snapshots: {e}",
                )
                return

        else:
            self.logger.log_task(
                action="error",
                message=f"{device['db_device'].hostname}: Invalid operation type: {operation_type}",
            )
            return

        return results

    def software_available_check(
            self,
            device: Dict,
            target_version: str,
    ) -> Optional[Dict]:
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

        # Retrieve available versions of PAN-OS
        device["pan_device"].software.check()
        available_versions = device["pan_device"].software.versions

        # Check if the target version is available
        if target_version in available_versions:
            return available_versions

    def software_download(
            self,
            device: Dict,
            target_version: str,
    ) -> str:
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

        try:
            device["pan_device"].software.download(target_version)
        except PanDeviceXapiError:
            return "errored"

        while True:
            device["pan_device"].software.info()
            dl_status = device["pan_device"].software.versions[target_version][
                "downloaded"
            ]

            if dl_status is True:
                return True

            time.sleep(30)

    def suspend_ha_device(
            self,
            device: Dict,
    ) -> bool:
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
            # Send API request to suspend the device
            suspension_response = device["pan_device"].op(
                "<request><high-availability><state><suspend/></state></high-availability></request>",
                cmd_xml=False,
            )

            # Parse the XML response to extract the result message
            response_message = flatten_xml_to_dict(suspension_response)

            # Check if the suspension was successful
            if (
                    response_message["result"]
                    == "Successfully changed HA state to suspended"
            ):
                self.logger.log_task(
                    action="success",
                    message=f"{device['db_device'].hostname}: HA state suspended.",
                )
                return True

            # Log the failure of HA state suspension
            else:
                self.logger.log_task(
                    action="error",
                    message=f"{device['db_device'].hostname}: Failed to suspend HA state.",
                )
                return False

        # Log any errors that occur during HA state suspension
        except Exception as e:
            self.logger.log_task(
                action="error",
                message=f"{device['db_device'].hostname}: Error suspending target device HA state: {e}",
            )
            return False

    def upgrade_active_devices(
            self,
            dry_run: bool,
            target_version: str,
    ) -> None:
        for each in self.upgrade_devices:
            if each["db_device"].local_state in ["active", "active-primary"]:
                try:
                    self.upgrade_firewall(
                        device=each,
                        dry_run=dry_run,
                        target_version=target_version,
                    )

                # General exception handling for celery task
                except WorkerLostError as exc:
                    self.logger.log_task(
                        action="error",
                        message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                    )
                    raise

                # General exception handling for upgrade process
                except Exception as exc:
                    self.logger.log_task(
                        action="error",
                        message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                    )
                    raise

