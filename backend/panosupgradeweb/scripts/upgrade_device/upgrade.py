import time
from http.client import RemoteDisconnected
from typing import Dict, Optional, Tuple, Union
from django.utils import timezone
from django.db import transaction

# Palo Alto Networks SDK imports
from panos.firewall import Firewall
from panos.panorama import Panorama
from panos.errors import (
    PanDeviceError,
    PanDeviceXapiError,
    PanXapiError,
    PanConnectionTimeout,
    PanURLError,
)


# Palo Alto Networks Assurance imports
from panos_upgrade_assurance.check_firewall import CheckFirewall
from panos_upgrade_assurance.firewall_proxy import FirewallProxy

# pan-os-upgrade imports
from pan_os_upgrade.components.utilities import flatten_xml_to_dict
from pan_os_upgrade.components.assurance import AssuranceOptions

# pan-os-upgrade-web imports
from panosupgradeweb.models import (
    ArpTableEntry,
    ContentVersion,
    Device,
    Job,
    License,
    NetworkInterface,
    Profile,
    Route,
    Snapshot,
    SessionStats,
)
from panosupgradeweb.scripts.logger import PanOsUpgradeLogger


class PanosUpgrade:
    """
    A class to handle the PAN-OS upgrade process for Palo Alto Networks devices.

    This class provides methods to perform various tasks related to upgrading PAN-OS devices,
    such as checking version compatibility, preparing upgrade devices, upgrading passive and
    active devices, and handling HA scenarios.

    Attributes:
        job_id (str): The ID of the job associated with the upgrade.
        logger (PanOsUpgradeLogger): An instance of the UpgradeLogger class for logging upgrade-related messages.
        primary_device (Dict): A dictionary containing information about the primary device in an HA pair.
        secondary_device (Dict): A dictionary containing information about the secondary device in an HA pair.
        standalone_device (Dict): A dictionary containing information about a standalone device.
        ha_details (Dict): A dictionary containing details about the HA configuration.
        version_local_parsed (Tuple): The parsed version of the local device.
        version_peer_parsed (Tuple): The parsed version of the peer device.
        version_target_parsed (Tuple): The parsed version of the target upgrade.

    Methods:
        - __init__(self, job_id: str): Initialize the PanosUpgrade instance with the given job ID.
        - assign_device(self, device_dict: Dict) -> str: Assign a device dictionary to the appropriate attribute based
        on its local state.
        - assign_upgrade_devices(self, device_uuid: str, profile_uuid: str) -> None: Assign the devices to be upgraded
        to the appropriate attributes based on their HA status.
        - check_ha_compatibility(self, current_version: Tuple, hostname: str, target_version: Tuple) -> None: Check the
        compatibility of upgrading a firewall in an HA pair to a target version.
        - compare_versions(self, local_version_sliced: Tuple, hostname: str, peer_version_sliced: Tuple) -> str: Compare
        two version tuples and determine their relative order.
        - determine_upgrade(self, hostname: str, current_version: Tuple, target_version: Tuple) -> None: Determine if a
        firewall requires an upgrade based on the current and target versions.
        - get_ha_status(self, device: Firewall) -> None: Retrieve the deployment information and HA status of
        a firewall device.
        - perform_readiness_checks(self, device: Dict) -> str: Perform readiness checks on a firewall device before the
        upgrade process.
        - run_assurance(self, device: Dict, operation_type: str, snapshot_type: str = None) -> None: Run assurance
        checks or snapshots on a firewall device.
        - software_available_check(self, device: Union[Firewall, Panorama], target_version: str) -> bool:
        Check if a software update to the target version is available and compatible.
        - software_download(self, device: Union[Firewall, Panorama], target_version: str) -> bool: Download the target
        software version to the firewall device.
        - suspend_ha_device(self, device: Dict) -> bool: Suspend the active device in a high-availability (HA) pair.
        - take_snapshot(self, device: Dict, snapshot_type: str) -> str: Take a snapshot of the network state information
        for a firewall device.
    """

    def __init__(
        self,
        job_id: str,
        profile_uuid: str,
    ):
        self.ha_details = None
        self.job_id: str = job_id
        self.logger = PanOsUpgradeLogger("pan-os-upgrade-upgrade")
        self.logger.set_job_id(job_id)
        self.post_snapshot = None
        self.pre_snapshot = None
        self.profile_uuid = profile_uuid
        self.profile = {
            "authentication": {},
            "checks": {},
            "download": {},
            "install": {},
            "reboot": {},
            "snapshots": {},
            "timeout": {},
        }
        self.primary_device = None
        self.secondary_device = None
        self.set_profile_settings()
        self.readiness_checks_succeeded: bool = False
        self.snapshot_attempt: int = 0
        self.snapshot_succeeded: bool = False
        self.standalone_device = None
        self.stop_upgrade_workflow: bool = False
        self.version_local_parsed: tuple = ()
        self.version_peer_parsed: tuple = ()
        self.version_target_parsed: tuple = ()
        self.upgrade_required: bool = False
        self.upgrade_succeeded: bool = False

    def assign_device(
        self,
        device_dict: Dict,
    ):
        """
        Assign a device dictionary to the appropriate attribute based on its local state.

        This function takes a device dictionary and assigns it to either the `primary_device` or `secondary_device`
        attribute of the class instance based on the value of the 'local_state' key in the dictionary.
        The `primary_device` attribute represents the device in the active or active-primary state, while the
        `secondary_device` attribute represents the device in any other state.

        If the 'local_state' is "active" or "active-primary", the device is assigned to the `primary_device`
        attribute. Otherwise, it is assigned to the `secondary_device` attribute. The function modifies the
        class instance's attributes based on the assignment.

        Args:
            device_dict (Dict): A dictionary containing information about the device, including the
                'local_state' key which determines the assignment.

        Returns:
            str: The attribute name ("primary" or "secondary") t
        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B{Is 'local_state' in ["active", "active-primary"]?}
                B -->|Yes| C[Assign device_dict to self.primary_device]
                B -->|No| D[Assign device_dict to self.secondary_device]
                C --> E[Set assigned_as to "primary"]
                D --> F[Set assigned_as to "secondary"]
                E --> G[Return assigned_as]
                F --> G
            ```
        """
        self.update_current_step(
            f"{device_dict['db_device'].hostname}: Assign a device dictionary to the attribute based on its local state"
        )
        if device_dict["db_device"].local_state in ["active", "active-primary"]:
            # Assign device_dict to the primary attribute if 'local_state' is "active" or "active-primary"
            self.primary_device = device_dict
            assigned_as = "primary"
        else:
            # Assign device_dict to the secondary_device attribute for any other 'local_state' value
            self.secondary_device = device_dict
            assigned_as = "secondary"

        return assigned_as

    def assign_upgrade_devices(
        self,
        device_uuid: str,
        profile_uuid: str,
    ) -> None:
        """
        Assign the devices to be upgraded to the appropriate attributes based on their HA status.

        This function retrieves the device and profile objects based on the provided UUIDs and assigns
        the devices to the `self.primary_device`, `self.secondary_device`, or `self.standalone_device` attributes.
        It handles both Panorama-managed and standalone firewalls.

        If the device is in an HA pair, it determines the active/passive status and assigns the devices
        to the `primary_device` or `secondary_device` attributes accordingly. If the device is standalone, it assigns
        the device to the `standalone_device` attribute.

        Args:
            device_uuid (str): The UUID of the device to be upgraded.
            profile_uuid (str): The UUID of the profile associated with the device.

        Returns:
            None

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B{Is device Panorama-managed?}
                B -->|Yes| C[Create Panorama-managed firewall object]
                B -->|No| D[Create standalone_device firewall object]
                C --> E[Create device dictionary]
                D --> E
                E --> F{Is device in an HA pair?}
                F -->|Yes| G[Get HA status]
                F -->|No| H[Assign device to standalone_device attribute]
                G --> I{Is device active or active-primary?}
                I -->|Yes| J[Assign device to primary_device attribute]
                I -->|No| K[Assign device to secondary_device attribute]
                J --> L{Is peer device available?}
                K --> L
                L -->|Yes| M[Create peer firewall object]
                L -->|No| N[End]
                M --> O{Is peer device active or active-primary?}
                O -->|Yes| P[Assign peer device to primary attribute]
                O -->|No| Q[Assign peer device to secondary_device attribute]
                P --> N
                Q --> N
                H --> N
            ```
        """
        self.update_current_step(
            "Assign the devices to be upgraded to the appropriate attributes based on their HA status"
        )
        # Retrieve the device object based on the provided device UUID
        device = Device.objects.get(uuid=device_uuid)
        peer = None

        # Check if the device is in an HA pair and retrieve the peer device if available
        if device.ha_enabled:
            peer = Device.objects.get(pk=device.peer_device.pk)

        devices = [
            device,
            peer if peer else None,
        ]

        # Retrieve the profile object based on the provided profile UUID
        profile = Profile.objects.get(uuid=profile_uuid)

        # Loop over the devices (primary and peer, if available)
        for each in devices:
            if each is None:
                continue

            # Create the firewall object based on whether the device is Panorama-managed or standalone
            if each.panorama_managed:
                firewall = Firewall(
                    serial=each.serial,
                    api_username=self.profile["authentication"]["pan_username"],
                    api_password=self.profile["authentication"]["pan_password"],
                )
                pan = Panorama(
                    hostname=(
                        each.panorama_ipv4_address
                        if each.panorama_ipv4_address
                        else each.ipv6_address
                    ),
                    api_username=self.profile["authentication"]["pan_username"],
                    api_password=self.profile["authentication"]["pan_password"],
                )
                pan.add(firewall)
            else:
                firewall = Firewall(
                    hostname=each.ipv4_address,
                    api_username=self.profile["authentication"]["pan_username"],
                    api_password=self.profile["authentication"]["pan_password"],
                )

            # Create a dictionary containing the device, job ID, firewall object, and profile
            device_dict = {
                "db_device": each,
                "job_id": self.job_id,
                "pan_device": firewall,
                "profile": profile,
            }
            self.logger.log_task(
                action="report",
                message=f"{device_dict['db_device'].hostname}: Device object created.",
            )

            # Check if the device is in an HA pair
            if each.ha_enabled:
                # Get the HA status of the device and assign it to the appropriate attribute
                assigned_as = self.assign_device(
                    device_dict=device_dict,
                )

                if assigned_as == "primary":
                    self.primary_device = device_dict
                    self.logger.log_task(
                        action="report",
                        message=f"{device_dict['db_device'].hostname}: Device assigned as primary firewall within "
                        "the HA pair.",
                    )
                else:
                    self.secondary_device = device_dict
                    self.logger.log_task(
                        action="report",
                        message=f"{device_dict['db_device'].hostname}: Device assigned as secondary firewall within "
                        "the HA pair.",
                    )

            else:
                # Assign the standalone device to the standalone attribute
                self.standalone_device = device_dict
                self.logger.log_task(
                    action="report",
                    message=f"{device_dict['db_device'].hostname}: Device assigned as standalone.",
                )

    def check_ha_compatibility(
        self,
        current_version: Tuple[int, int, int, int],
        hostname: str,
        target_version: Tuple[int, int, int, int],
    ) -> None:
        """
        Check the compatibility of upgrading a firewall in an HA pair to a target version.

        This function compares the current version and target version of a firewall in an HA pair
        to determine if the upgrade is compatible. It checks for the following scenarios:
        - If the major upgrade is more than one release apart
        - If the upgrade is within the same major version but the minor upgrade is more than one release apart
        - If the upgrade spans exactly one major version but also increases the minor version

        If any of these scenarios are encountered, a warning message is logged, and the `self.stop_upgrade_workflow`
        flag is set to True to halt the upgrade process.

        Args:
            self: The instance of the class containing this method.
            current_version (Tuple[int, int, int, int]): The current version of the firewall in the format
                (major, minor, patch, build).
            hostname (str): The hostname of the firewall device.
            target_version (Tuple[int, int, int, int]): The target version for the upgrade in the format
                (major, minor, patch, build).

        Returns:
            None

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B{Major upgrade more than one release apart?}
                B -->|Yes| C[Log warning, set stop_upgrade_workflow to True]
                B -->|No| D{Within same major version and minor upgrade more than one release apart?}
                D -->|Yes| E[Log warning, set stop_upgrade_workflow to True]
                D -->|No| F{Spans exactly one major version and increases minor version?}
                F -->|Yes| G[Log warning, set stop_upgrade_workflow to True]
                F -->|No| H[Log compatibility check success]
            ```
        """

        self.update_current_step(
            f"{hostname}: Check the compatibility of upgrading a firewall in an HA pair to a target version"
        )

        # Check if the major upgrade is more than one release apart
        if target_version[0] - current_version[0] > 1:
            self.logger.log_task(
                action="warning",
                message=f"{hostname}: Upgrading firewalls in an HA pair to a version that is more "
                f"than one major release apart may cause compatibility issues.",
            )

            # Update the value of `self.stop_upgrade_workflow` to halt the upgrade process
            self.stop_upgrade_workflow = True

        # Check if the upgrade is within the same major version but the minor upgrade is more than one release apart
        elif (
            target_version[0] == current_version[0]
            and target_version[1] - current_version[1] > 1
        ):
            self.logger.log_task(
                action="warning",
                message=f"{hostname}: Upgrading firewalls in an HA pair to a version that is more "
                f"than one minor release apart may cause compatibility issues.",
            )

            # Update the value of `self.stop_upgrade_workflow` to halt the upgrade process
            self.stop_upgrade_workflow = True

        # Check if the upgrade spans exactly one major version but also increases the minor version
        elif target_version[0] - current_version[0] == 1 and target_version[1] > 0:
            self.logger.log_task(
                action="warning",
                message=f"{hostname}: Upgrading firewalls in an HA pair to a version that spans "
                f"more than one major release or increases the minor version beyond the first in the next "
                f"major release may cause compatibility issues.",
            )

            # Update the value of `self.stop_upgrade_workflow` to halt the upgrade process
            self.stop_upgrade_workflow = True

        # Log compatibility check success
        self.logger.log_task(
            action="success",
            message=f"{hostname}: The target version is compatible with the current version.",
        )

    def compare_versions(
        self,
        local_version_sliced: Tuple[int, int, int, int],
        hostname: str,
        peer_version_sliced: Tuple[int, int, int, int],
    ) -> str:
        """
        Compare two version tuples and determine their relative order.

        This function takes two version tuples as input and compares them to determine
        which version is older, newer, or equal. The version tuples are assumed to be
        in the format (major, minor, patch, build).

        Args:
            local_version_sliced (Tuple[int, int, int, int]): The version tuple of the local device.
            hostname (str): Device's hostname.
            peer_version_sliced (Tuple[int, int, int, int]): The version tuple of the peer device.

        Returns:
            str: The relative order of the versions:
                - "older" if the local version is older than the peer version
                - "newer" if the local version is newer than the peer version
                - "equal" if the local version is equal to the peer version

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B[Compare local and peer version tuples]
                B -->|local < peer| C[Return "older"]
                B -->|local > peer| D[Return "newer"]
                B -->|local == peer| E[Return "equal"]
            ```
        """

        self.update_current_step(
            f"{hostname}: Compare two version tuples and determine their relative order"
        )

        # Log the task of comparing version strings for the device
        self.logger.log_task(
            action="search",
            message=f"{hostname}: Comparing version strings",
        )

        # Compare the local and peer version tuples and return the relative order
        if local_version_sliced < peer_version_sliced:
            return "older"
        elif local_version_sliced > peer_version_sliced:
            return "newer"
        else:
            return "equal"

    def determine_upgrade(
        self,
        hostname: str,
        current_version: Tuple[int, int, int, int],
        target_version: Tuple[int, int, int, int],
    ) -> None:
        """
        Determine if a firewall requires an upgrade based on the current and target versions.

        This function compares the current version of a firewall with the target version to determine
        if an upgrade is necessary. An upgrade is required when the current version is less than the
        target version. It logs the current and target versions and checks if the current version is
        less than the target version. If an upgrade is required, it logs the appropriate message and
        sets `self.upgrade_required` to True. If no upgrade is required or a downgrade attempt is
        detected, it logs the corresponding messages, halts the upgrade, and sets
        `self.upgrade_required` to False.

        Args:
            hostname (str): The hostname of the firewall device.
            current_version (Tuple[int, int, int, int]): The current version of the firewall as a tuple
                in the format (major, minor, patch, maintenance).
            target_version (Tuple[int, int, int, int]): The target version for the upgrade as a tuple
                in the format (major, minor, patch, maintenance).

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B[Log current and target versions]
                B --> C{Is current version less than target version?}
                C -->|Yes| D[Log upgrade required message]
                C -->|No| E[Log no upgrade required or downgrade attempt detected]
                D --> F[Set self.upgrade_required to True]
                E --> G[Log halting upgrade message]
                G --> H[Set self.upgrade_required to False]
            ```
        """
        self.update_current_step(
            f"{hostname}: Determine if the device requires an upgrade based on the current and target versions"
        )

        # Log the current and target versions
        self.logger.log_task(
            action="report",
            message=f"{hostname}: Current version: {current_version}.",
        )
        self.logger.log_task(
            action="report",
            message=f"{hostname}: Target version: {target_version}.",
        )

        if current_version < target_version:
            # Log upgrade required message if the current version is less than the target version
            self.logger.log_task(
                action="report",
                message=f"{hostname}: Upgrade required from {current_version} to {target_version}",
            )
            self.upgrade_required = True

        else:
            # Log no upgrade required or downgrade attempt detected message
            self.logger.log_task(
                action="skipped",
                message=f"{hostname}: No upgrade required or downgrade attempt detected.",
            )
            # Log halting upgrade message
            self.logger.log_task(
                action="stop",
                message=f"{hostname}: Halting upgrade.",
            )

            # ensure self.upgrade_required = False
            self.upgrade_required = False

    def get_ha_status(
        self,
        device: Firewall,
    ) -> None:
        """
        Retrieve the deployment information and HA status of a firewall device.

        This function uses the `show_highavailability_state()` method to retrieve the deployment type
        and HA details of the specified firewall device. It logs the progress and results of the operation
        using the `self.logger.log_task()` function.

        Args:
            device (Firewall): An object representing the firewall device.

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

        self.update_current_step(
            f"{device['db_device'].hostname}: Retrieve the deployment information and HA status of a firewall device"
        )

        # Get the deployment type using show_highavailability_state()
        deployment_type = device.show_highavailability_state()

        # Check if HA details are available
        if deployment_type[1]:
            # Flatten the XML to a dictionary if HA details are available
            self.ha_details = flatten_xml_to_dict(element=deployment_type[1])

    def perform_readiness_checks(
        self,
        device: Dict,
    ) -> None:
        """
        Perform readiness checks on a firewall device before the upgrade process.

        This function executes readiness checks on a firewall device to ensure it is ready for an upgrade.
        It attempts to run the readiness checks operation multiple times, with a specified retry interval,
        until the checks are successfully completed or the maximum number of retries is reached.

        If a readiness check fails and its 'exit_on_failure' attribute is set to True, the function logs an
        error message using the check's description and returns an "errored" status. If a readiness check fails
        but its 'exit_on_failure' attribute is set to False, the function logs a warning message and continues
        with the execution.

        Args:
            device (Dict): A dictionary containing information about the firewall device.

        Returns:
            None
        """
        self.update_current_step(
            f"{device['db_device'].hostname}: Perform readiness checks on a firewall device before the upgrade process"
        )

        # Attempt to perform readiness checks
        self.readiness_checks_succeeded = False

        # Perform a Readiness Checks attempt
        try:
            # Execute the readiness checks operation
            self.run_assurance(
                device=device,
                operation_type="readiness_checks",
            )

        # Catch specific and general exceptions
        except (AttributeError, IOError, Exception) as error:
            # Log the readiness checks error message
            self.logger.log_task(
                action="error",
                message=f"{device['db_device'].hostname}: Readiness Checks attempt failed with error: {error}.",
            )

        # If the readiness checks fail
        if not self.readiness_checks_succeeded:
            # Log the readiness checks error message
            self.logger.log_task(
                action="error",
                message=f"{device['db_device'].hostname}: Failed to perform readiness checks.",
            )
            # Set self.readiness_checks_succeeded to False to indicate failure
            self.readiness_checks_succeeded = False

        # If the readiness checks succeeded
        else:
            # Log the readiness checks success message
            self.logger.log_task(
                action="success",
                message=f"{device['db_device'].hostname}: Readiness checks successfully completed.",
            )

    def perform_reboot(
        self,
        device: Dict,
        target_version: str,
    ) -> None:
        """
        Initiates a reboot on a specified device (Firewall or Panorama) and verifies it boots up with the desired
        PAN-OS version.
        This function is critical in completing the upgrade process, ensuring that the device is running the expected
        software version
        post-reboot. It also supports High Availability (HA) configurations, checking for the HA pair's synchronization
        and functional status after the reboot.

        The process sends a reboot command to the device, waits for it to go offline and come back online, and then
        checks if the rebooted PAN-OS version matches the target version. For devices in an HA setup, additional steps
        are taken to verify the HA status and synchronization between the HA peers post-reboot.

        Parameters
        ----------
        device : Device
            The dict object representing either a PanDevice and its database object, with necessary connectivity details
        target_version : str
            The PAN-OS version that the device should be running after the reboot.

        Raises
        ------
        SystemExit
            If the device fails to reboot to the specified PAN-OS version after a set number of retries, or if HA
            synchronization is not achieved post-reboot, the script will terminate with an error.
        """

        self.update_current_step(
            f"{device['db_device'].hostname}: Initiate reboot on and verify it boots up with the desired PAN-OS version"
        )

        rebooted = False
        attempt = 0

        # Log the readiness checks success message
        self.logger.log_task(
            action="start",
            message=f"{device['db_device'].hostname}: Rebooting the device.",
        )

        # Initiate reboot
        device["pan_device"].op(
            "<request><restart><system/></restart></request>",
            cmd_xml=False,
        )

        # Wait for the target device reboot process to initiate before checking status
        time.sleep(60)

        while not rebooted and attempt < self.profile["reboot"]["maximum_attempts"]:
            try:
                # Refresh system information to check if the device is back online
                device["pan_device"].refresh_system_info()

                # Log the readiness checks success message
                self.logger.log_task(
                    action="report",
                    message=f"{device['db_device'].hostname}: Current device version: {device['pan_device'].version}.",
                )

                # Check if the device has rebooted to the target version
                if device["pan_device"].version == target_version:
                    # Log the successful upgrade/reboot
                    self.logger.log_task(
                        action="success",
                        message=f"{device['db_device'].hostname}: Device upgraded to {target_version} and rebooted "
                        f"successfully.",
                    )

                    rebooted = True

                else:
                    # Log the successful upgrade/reboot
                    self.logger.log_task(
                        action="error",
                        message=f"{device['db_device'].hostname}: Device rebooted but not to {target_version}.",
                    )

                    self.stop_upgrade_workflow = True

            except (
                PanXapiError,
                PanConnectionTimeout,
                PanURLError,
                RemoteDisconnected,
            ) as e:
                # Log that we are going to retry in a certain amount of time
                self.logger.log_task(
                    action="start",
                    message=f"{device['db_device'].hostname}: Retry attempt {attempt + 1} due to error: {e}.",
                )

                attempt += 1
                time.sleep(self.profile["reboot"]["retry_interval"])

        if not rebooted:
            # Log that we are going to retry in a certain amount of time
            self.logger.log_task(
                action="error",
                message=f"{device['db_device'].hostname}: Failed to reboot to the target version after "
                f"{self.profile['reboot']['max_retries']} attempts.",
            )
            self.stop_upgrade_workflow = True

    def perform_upgrade(
        self,
        device: Dict,
        target_version: str,
    ) -> str:
        """
        Conducts the upgrade process for a Palo Alto Networks device to a specified version. This function handles
        downloading the necessary software version and executing the upgrade command. It is designed to work in both
        standalone and High Availability (HA) configurations, ensuring proper upgrade procedures are followed in each
        scenario.

        This function attempts the upgrade process up to a maximum number of retries defined in the settings file or
        default settings. If the software manager is busy, it waits for a specified interval before retrying.
        The function sets a boolean indicating the success or failure of the installation process.

        Parameters
        ----------
        device : Dict
            The device object representing the target Firewall or Panorama to be upgraded.
        target_version : str
            The target PAN-OS version to upgrade the device to.

        Returns
        -------
        str
            The status of the upgrade process ("completed", "errored").
        """

        self.update_current_step(
            f"{device['db_device'].hostname}: Begin the upgrade process for device to a specified version"
        )

        # Log message to console about starting the upgrade process
        self.logger.log_task(
            action="working",
            message=f"{device['db_device'].hostname}: Beginning PAN-OS upgrade",
        )

        # Initialize with default values
        attempt: int = 0

        # Log message to console about starting the upgrade process
        self.logger.log_task(
            action="working",
            message=f"{device['db_device'].hostname}: Attempt number {attempt + 1}, with a maximum attempts of "
            f"{self.profile['install']['maximum_attempts']}",
        )

        while attempt < self.profile["install"]["maximum_attempts"]:
            try:
                self.logger.log_task(
                    action="working",
                    message=f"{device['db_device'].hostname}: Attempting upgrade to version {target_version} (Attempt "
                    f"{attempt + 1} of {self.profile['install']['maximum_attempts']}).",
                )

                self.logger.log_task(
                    action="working",
                    message=f"{device['db_device'].hostname}: Calling device['pan_device'].software.install()",
                )

                install_job = device["pan_device"].software.install(
                    target_version,
                    sync=True,
                )

                self.logger.log_task(
                    action="working",
                    message=f"{device['db_device'].hostname}: Install job status: {install_job}",
                )

                if install_job["success"]:
                    self.logger.log_task(
                        action="working",
                        message=f"{device['db_device'].hostname}: Upgrade completed successfully.",
                    )

                    # Mark installation as successful
                    self.upgrade_succeeded = True

                    # Return "completed" status to indicate successful upgrade
                    return "completed"
                else:
                    attempt += 1
                    if attempt < self.profile["install"]["maximum_attempts"]:
                        self.logger.log_task(
                            action="working",
                            message=f"{device['db_device'].hostname}: Retrying in "
                            f"{self.profile['install']['retry_interval']} seconds.",
                        )
                        time.sleep(self.profile["install"]["retry_interval"])

            # Log specific exceptions that occur during the upgrade process
            except (PanDeviceError, PanXapiError) as e:
                self.logger.log_task(
                    action="error",
                    message=f"{device['db_device'].hostname}: Error upgrading device: {str(e)}",
                )

                # Set self.stop_upgrade_workflow to True
                self.stop_upgrade_workflow = True

                # Return "errored" status to indicate upgrade failure
                return "errored"

            # Log any other exceptions that occur during the upgrade process
            except Exception as e:
                self.logger.log_task(
                    action="error",
                    message=f"{device['db_device'].hostname}: Unexpected error upgrading device: {str(e)}",
                )

                # Set self.stop_upgrade_workflow to True
                self.stop_upgrade_workflow = True

                # Return "errored" status to indicate upgrade failure
                return "errored"

        # If the upgrade fails after max_retries
        if not self.upgrade_succeeded:
            self.logger.log_task(
                action="working",
                message=f"{device['db_device'].hostname}: Upgrade failed after "
                f"{self.profile['install']['maximum_attempts']} attempts.",
            )
            return "errored"

    def run_assurance(
        self,
        device: Dict,
        operation_type: str,
        snapshot_type: str = None,
    ) -> None:
        """
        Run assurance checks or snapshots on a firewall device.

        This function sets up a FirewallProxy and CheckFirewall instance for the given device,
        and performs assurance operations based on the specified operation_type.

        Args:
            device (Dict): A dictionary containing information about the firewall device.
                The dictionary should include the following keys:
                - "pan_device": An instance of the PanDevice class representing the firewall.
                - "profile": An instance of the FirewallProfile class containing snapshot settings.
            operation_type (str): The type of assurance operation to perform. Valid values are:
                - "state_snapshot": Take snapshots of various firewall states.
                - "readiness_checks": Perform readiness checks on the firewall device.
            snapshot_type (str): The type of snapshot operation to perform. Valid values are:
                - "pre_upgrade": Take snapshots of various pre-upgrade operations.
                - "post_upgrade": Take snapshots of various post-upgrade operations.

        Returns:
            None
        """

        self.update_current_step(
            f"{device['db_device'].hostname}: Run the 'Upgrade Assurance' tasks on device."
        )

        # Setup Firewall client
        checks_firewall = CheckFirewall(
            FirewallProxy(device["pan_device"]),
        )

        if operation_type == "state_snapshot":
            try:
                actions = {
                    "arp_table": device["profile"].arp_table_snapshot,
                    "content_version": device["profile"].content_version_snapshot,
                    "ip_sec_tunnels": device["profile"].ip_sec_tunnels_snapshot,
                    "license": device["profile"].license_snapshot,
                    "nics": device["profile"].nics_snapshot,
                    "routes": device["profile"].routes_snapshot,
                    "session_stats": device["profile"].session_stats_snapshot,
                }

                # Create a list of action names where the corresponding value is True
                enabled_actions = [
                    action for action, enabled in actions.items() if enabled
                ]

                snapshot_results = checks_firewall.run_snapshots(
                    snapshots_config=enabled_actions
                )

                if snapshot_type == "pre_upgrade":
                    self.pre_snapshot = snapshot_results
                else:
                    self.post_snapshot = snapshot_results

                if snapshot_results:
                    try:
                        # Retrieve the Job object using the job_id
                        job = Job.objects.get(task_id=self.job_id)

                        # Create a new Snapshot instance and associate it with the job and device
                        snapshot = Snapshot.objects.create(
                            job=job,
                            device=device["db_device"],
                            snapshot_type=snapshot_type,
                        )

                        # Create a new ContentVersion instance if the content version is available
                        if "content_version" in snapshot_results:
                            ContentVersion.objects.create(
                                snapshot=snapshot,
                                version=snapshot_results["content_version"]["version"],
                            )

                        # Create License instances for each license in the snapshot results
                        if "license" in snapshot_results:
                            for license_name, license_data in snapshot_results[
                                "license"
                            ].items():
                                base_license_name = license_data.get(
                                    "base-license-name", ""
                                )  # Use an empty string as default if the field is missing
                                License.objects.create(
                                    snapshot=snapshot,
                                    feature=license_data["feature"],
                                    description=license_data["description"],
                                    serial=license_data["serial"],
                                    issued=license_data["issued"],
                                    expires=license_data["expires"],
                                    expired=license_data["expired"],
                                    base_license_name=base_license_name,
                                    authcode=license_data["authcode"],
                                    custom=license_data.get("custom"),
                                )

                        # Create NetworkInterface instances for each network interface in the snapshot results
                        if "nics" in snapshot_results:
                            for nic_name, nic_status in snapshot_results[
                                "nics"
                            ].items():
                                NetworkInterface.objects.create(
                                    snapshot=snapshot,
                                    name=nic_name,
                                    status=nic_status,
                                )

                        # Create ArpTableEntry instances for each ARP table entry in the snapshot results
                        if "arp_table" in snapshot_results:
                            for arp_entry in snapshot_results["arp_table"].values():
                                ArpTableEntry.objects.create(
                                    snapshot=snapshot,
                                    interface=arp_entry["interface"],
                                    ip=arp_entry["ip"],
                                    mac=arp_entry["mac"],
                                    port=arp_entry["port"],
                                    status=arp_entry["status"],
                                    ttl=int(arp_entry["ttl"]),
                                )

                        # Create Route instances for each route in the snapshot results
                        if "routes" in snapshot_results:
                            for route in snapshot_results["routes"].values():
                                Route.objects.create(
                                    snapshot=snapshot,
                                    virtual_router=route["virtual-router"],
                                    destination=route["destination"],
                                    nexthop=route["nexthop"],
                                    metric=int(route["metric"]),
                                    flags=route["flags"],
                                    age=int(route["age"]) if route["age"] else None,
                                    interface=route["interface"],
                                    route_table=route["route-table"],
                                )

                        # Create SessionStats instance for the session statistics in the snapshot results
                        if "session_stats" in snapshot_results:
                            stats = snapshot_results["session_stats"]
                            SessionStats.objects.create(
                                snapshot=snapshot,
                                age_accel_thresh=int(stats["age-accel-thresh"]),
                                age_accel_tsf=int(stats["age-accel-tsf"]),
                                age_scan_ssf=int(stats["age-scan-ssf"]),
                                age_scan_thresh=int(stats["age-scan-thresh"]),
                                age_scan_tmo=int(stats["age-scan-tmo"]),
                                cps=int(stats["cps"]),
                                dis_def=int(stats["dis-def"]),
                                dis_sctp=int(stats["dis-sctp"]),
                                dis_tcp=int(stats["dis-tcp"]),
                                dis_udp=int(stats["dis-udp"]),
                                icmp_unreachable_rate=int(
                                    stats["icmp-unreachable-rate"]
                                ),
                                kbps=int(stats["kbps"]),
                                max_pending_mcast=int(stats["max-pending-mcast"]),
                                num_active=int(stats["num-active"]),
                                num_bcast=int(stats["num-bcast"]),
                                num_gtpc=int(stats["num-gtpc"]),
                                num_gtpu_active=int(stats["num-gtpu-active"]),
                                num_gtpu_pending=int(stats["num-gtpu-pending"]),
                                num_http2_5gc=int(stats["num-http2-5gc"]),
                                num_icmp=int(stats["num-icmp"]),
                                num_imsi=int(stats["num-imsi"]),
                                num_installed=int(stats["num-installed"]),
                                num_max=int(stats["num-max"]),
                                num_mcast=int(stats["num-mcast"]),
                                num_pfcpc=int(stats["num-pfcpc"]),
                                num_predict=int(stats["num-predict"]),
                                num_sctp_assoc=int(stats["num-sctp-assoc"]),
                                num_sctp_sess=int(stats["num-sctp-sess"]),
                                num_tcp=int(stats["num-tcp"]),
                                num_udp=int(stats["num-udp"]),
                                pps=int(stats["pps"]),
                                tcp_cong_ctrl=int(stats["tcp-cong-ctrl"]),
                                tcp_reject_siw_thresh=int(
                                    stats["tcp-reject-siw-thresh"]
                                ),
                                tmo_5gcdelete=int(stats["tmo-5gcdelete"]),
                                tmo_cp=int(stats["tmo-cp"]),
                                tmo_def=int(stats["tmo-def"]),
                                tmo_icmp=int(stats["tmo-icmp"]),
                                tmo_sctp=int(stats["tmo-sctp"]),
                                tmo_sctpcookie=int(stats["tmo-sctpcookie"]),
                                tmo_sctpinit=int(stats["tmo-sctpinit"]),
                                tmo_sctpshutdown=int(stats["tmo-sctpshutdown"]),
                                tmo_tcp=int(stats["tmo-tcp"]),
                                tmo_tcp_delayed_ack=int(stats["tmo-tcp-delayed-ack"]),
                                tmo_tcp_unverif_rst=int(stats["tmo-tcp-unverif-rst"]),
                                tmo_tcphalfclosed=int(stats["tmo-tcphalfclosed"]),
                                tmo_tcphandshake=int(stats["tmo-tcphandshake"]),
                                tmo_tcpinit=int(stats["tmo-tcpinit"]),
                                tmo_tcptimewait=int(stats["tmo-tcptimewait"]),
                                tmo_udp=int(stats["tmo-udp"]),
                                vardata_rate=int(stats["vardata-rate"]),
                            )

                        self.logger.log_task(
                            action="success",
                            message=f"{device['db_device'].hostname}: Snapshot creation completed successfully",
                        )

                        self.snapshot_succeeded = True

                    except Exception as e:
                        # Log the error message
                        self.logger.log_task(
                            action="error",
                            message=f"{device['db_device'].hostname}: Error creating snapshot: {str(e)}",
                        )

                        # Set the value of self.stop_upgrade_workflow to halt the upgrade workflow
                        self.snapshot_succeeded = False

                else:
                    # Log the error message
                    self.logger.log_task(
                        action="error",
                        message=f"{device['db_device'].hostname}: Error creating snapshot",
                    )

                    # Set the value of self.stop_upgrade_workflow to halt the upgrade workflow
                    self.snapshot_succeeded = False

            except Exception as e:
                self.logger.log_task(
                    action="error",
                    message=f"{device['db_device'].hostname}: An error occurred during snapshots: {str(e)}",
                )
                self.readiness_checks_succeeded = False

        if operation_type == "readiness_checks":
            try:
                actions = {
                    "active_support": device["profile"].active_support,
                    "candidate_config": device["profile"].candidate_config,
                    "certificates_requirements": device[
                        "profile"
                    ].certificates_requirements,
                    "content_version": device["profile"].content_version,
                    "dynamic_updates": device["profile"].dynamic_updates,
                    "expired_licenses": device["profile"].expired_licenses,
                    "free_disk_space": device["profile"].free_disk_space,
                    "ha": device["profile"].ha,
                    "jobs": device["profile"].jobs,
                    "ntp_sync": device["profile"].ntp_sync,
                    "panorama": device["profile"].panorama,
                    "planes_clock_sync": device["profile"].planes_clock_sync,
                }
                for action in actions:
                    if action not in AssuranceOptions.READINESS_CHECKS.keys():
                        self.logger.log_task(
                            action="report",
                            message=f"{device['db_device'].hostname}: Invalid action for readiness check: {action}",
                        )

                # Create a list of action names where the corresponding value is True
                enabled_actions = [
                    action for action, enabled in actions.items() if enabled
                ]

                # Run the snapshots using CheckFirewall
                self.logger.log_task(
                    action="start",
                    message=f"{device['db_device'].hostname}: Begin running the readiness checks",
                )

                result = checks_firewall.run_readiness_checks(
                    checks_configuration=enabled_actions
                )

                self.readiness_checks_succeeded = True

                for (
                    test_name,
                    test_info,
                ) in AssuranceOptions.READINESS_CHECKS.items():
                    test_result = result.get(
                        test_name, {"state": False, "reason": "Skipped Readiness Check"}
                    )

                    if test_result["state"]:
                        self.logger.log_task(
                            action="success",
                            message=f"{device['db_device'].hostname}: Passed Readiness Check: {test_info['description']}",
                        )
                    else:
                        reason = test_result["reason"]
                        log_message = f'{reason}: {test_info["description"]}'

                        if reason == "Skipped Readiness Check":
                            # Log the skipped message
                            self.logger.log_task(
                                action="skipped",
                                message=f"{device['db_device'].hostname}: {log_message}, but continuing with the execution",
                            )
                        elif test_info["exit_on_failure"]:
                            # Log the error message
                            self.logger.log_task(
                                action="error",
                                message=f"{device['db_device'].hostname}: {log_message}, halting upgrade workflow.",
                            )

                            # Set the value of self.readiness_checks_succeeded to False
                            self.readiness_checks_succeeded = False
                        else:
                            # Log the warning message
                            self.logger.log_task(
                                action="warning",
                                message=f"{device['db_device'].hostname}: {log_message}, but continuing with the "
                                f"execution",
                            )

            except Exception as e:
                self.logger.log_task(
                    action="error",
                    message=f"{device['db_device'].hostname}: An error occurred during readiness checks: {str(e)}",
                )
                self.readiness_checks_succeeded = False

    def set_profile_settings(self):
        """
        Set the profile settings based on the provided profile UUID.

        This function retrieves the profile object based on the given profile UUID and sets various attributes
        of the profile, including authentication, image download, image install, reboot, timeout, readiness checks,
        and snapshots. If the profile is not found, it raises a Profile.DoesNotExist exception.

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B{Profile exists?}
                B -->|Yes| C[Retrieve profile object]
                C --> D[Set authentication attributes]
                D --> E[Set image download attributes]
                E --> F[Set image install attributes]
                F --> G[Set reboot attributes]
                G --> H[Set timeout attributes]
                H --> I[Set readiness checks]
                I --> J[Set snapshot attributes]
                J --> K[Set snapshot state]
                K --> L[Log success message]
                L --> M[End]
                B -->|No| N[Log error message]
                N --> O[Raise Profile.DoesNotExist exception]
                O --> M
            ```
        """

        self.update_current_step(
            "Set the profile settings based on the provided profile UUID."
        )

        try:
            # Retrieve the profile object based on the provided profile UUID
            profile = Profile.objects.get(uuid=self.profile_uuid)

            # Set up authentication attributes
            self.profile["authentication"]["pan_username"] = profile.pan_username
            self.profile["authentication"]["pan_password"] = profile.pan_password

            # Set up image download attributes
            self.profile["download"]["maximum_attempts"] = profile.max_download_tries
            self.profile["download"]["retry_interval"] = profile.download_retry_interval

            # Set up image install attributes
            self.profile["install"]["maximum_attempts"] = profile.max_install_attempts
            self.profile["install"]["retry_interval"] = profile.install_retry_interval

            # Set up reboot attributes
            self.profile["reboot"]["maximum_attempts"] = profile.max_reboot_tries
            self.profile["reboot"]["retry_interval"] = profile.reboot_retry_interval

            # Set up timeout attributes
            self.profile["timeout"]["command_timeout"] = profile.command_timeout
            self.profile["timeout"]["connection_timeout"] = profile.connection_timeout

            # Set up readiness checks
            self.profile["checks"]["active_support"] = profile.active_support
            self.profile["checks"]["candidate_config"] = profile.candidate_config
            self.profile["checks"]["certificates"] = profile.certificates_requirements
            self.profile["checks"]["content_version"] = profile.content_version
            self.profile["checks"]["dynamic_updates"] = profile.dynamic_updates
            self.profile["checks"]["expired_licenses"] = profile.expired_licenses
            self.profile["checks"]["free_disk_space"] = profile.free_disk_space
            self.profile["checks"]["ha"] = profile.ha
            self.profile["checks"]["jobs"] = profile.jobs
            self.profile["checks"]["ntp_sync"] = profile.ntp_sync
            self.profile["checks"]["panorama"] = profile.panorama
            self.profile["checks"]["planes_clock_sync"] = profile.planes_clock_sync

            # Set up snapshot attributes
            self.profile["snapshots"]["maximum_attempts"] = profile.max_snapshot_tries
            self.profile["snapshots"][
                "retry_interval"
            ] = profile.snapshot_retry_interval

            # Set up snapshots
            self.profile["snapshots"]["arp_table"] = profile.arp_table_snapshot
            self.profile["snapshots"]["content"] = profile.content_version_snapshot
            self.profile["snapshots"]["ipsec"] = profile.ip_sec_tunnels_snapshot
            self.profile["snapshots"]["license"] = profile.license_snapshot
            self.profile["snapshots"]["nics"] = profile.nics_snapshot
            self.profile["snapshots"]["routes"] = profile.routes_snapshot
            self.profile["snapshots"]["sessions"] = profile.session_stats_snapshot

            # Log message upon completion
            self.logger.log_task(
                action="success",
                message=f"Profile settings retrieved and set for profile UUID: {self.profile_uuid}",
            )

        except Profile.DoesNotExist:
            self.logger.log_task(
                action="error",
                message=f"Profile with UUID {self.profile_uuid} does not exist",
            )
            raise

    def software_available_check(
        self,
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
        6. If the base image is already downloaded or successfully downloaded, returns the available versions.
        7. If the target version is not available or the download fails after multiple attempts, returns None.

        Args:
            device (Union[Firewall, Panorama]): The firewall or Panorama device object.
            target_version (str): The target software version to check for availability and compatibility.

        Returns:
            bool
        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B[Parse target version]
                B --> C[Check if target version is older than current version]
                C --> D[Verify compatibility with current version and HA setup]
                D --> E{Compatible?}
                E -->|No| F[Return None]
                E -->|Yes| G[Retrieve available software versions]
                G --> H{Target version available?}
                H -->|No| I[Return None]
                H -->|Yes| J{Base image downloaded?}
                J -->|Yes| K[Return available versions]
                J -->|No| L[Attempt base image download]
                L --> M{Download successful?}
                M -->|Yes| N[Wait for image to load]
                N --> O[Re-check available versions]
                O --> P{Target version available?}
                P -->|Yes| Q[Return available versions]
                P -->|No| R{Retry count exceeded?}
                R -->|No| S[Retry download]
                S --> L
                R -->|Yes| T[Return None]
                M -->|No| U{Retry count exceeded?}
                U -->|No| V[Wait and retry download]
                V --> L
                U -->|Yes| W[Return None]
            ```
        """

        self.update_current_step(
            f"{device['db_device'].hostname}: Check if a software update to the version is available and compatible."
        )

        # Retrieve available versions of PAN-OS
        device["pan_device"].software.check()
        available_versions = device["pan_device"].software.versions

        # Check if the target version is available
        if target_version in available_versions:
            self.logger.log_task(
                action="report",
                message=f"{device['db_device'].hostname}: {target_version} found in list of available versions.",
            )
            return True

    def software_download(
        self,
        device: Union[Firewall, Panorama],
        target_version: str,
    ) -> bool:
        """
        Download the target software version to the firewall device.

        This function checks if the target software version is already downloaded on the firewall device.
        If the version is not downloaded, it initiates the download process and monitors the download status.
        It logs the progress and status of the download operation.

        Args:
            device (Union[Firewall, Panorama]): The firewall or Panorama device object.
            target_version (str): The target software version to be downloaded.

        Returns:
            bool: True if the download is successful, False otherwise.

        Raises:
            PanDeviceXapiError: If an error occurs during the download initiation.

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B{Is target version already downloaded?}
                B -->|Yes| C[Log success and return True]
                B -->|No| D[Initiate download]
                D --> E{Download initiated successfully?}
                E -->|Yes| F[Monitor download progress]
                E -->|No| G[Log error and return False]
                F --> H{Download complete?}
                H -->|Yes| I[Log success and return True]
                H -->|No| J[Wait for 30 seconds]
                J --> F
            ```
        """

        self.update_current_step(
            f"{device['db_device'].hostname}: Download the target software version to the firewall device."
        )

        try:
            # Initiate the download of the target software version
            device.software.download(target_version)
        except PanDeviceXapiError:
            # return False if the download fails to initiate
            return False

        while True:
            # Refresh the software information on the device
            device.software.info()

            # Check the download status of the target version
            dl_status = device.software.versions[target_version]["downloaded"]

            if dl_status is True:
                return True

            # Wait for 30 seconds before checking the download status again
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

        self.update_current_step(
            f"{device['db_device'].hostname}: Suspend the active device in a high-availability (HA) pair."
        )

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

    def take_snapshot(
        self,
        device: Dict,
        snapshot_type: str,
    ) -> None:
        """
        Take a snapshot of the network state information for a firewall device.

        This function attempts to take a snapshot of the network state information for a firewall device.
        It retries the snapshot operation up to a maximum number of attempts specified by `self.max_retries`.
        If the snapshot is successful, it returns "completed". If the snapshot fails after multiple attempts,
        it returns "errored". If the firewall does not require an upgrade to the target version, it returns "skipped".

        Args:
            device (Dict): A dictionary containing information about the firewall device.
            snapshot_type (str): The type of snapshot operation to perform. Valid values are:
                - "pre": Take snapshots of various pre-upgrade operations.
                - "post": Take snapshots of various post-upgrade operations.

        Returns:
            str: The status of the snapshot operation ("completed", "skipped", or "errored").

        Raises:
            AttributeError: If an attribute is missing or invalid during the snapshot operation.
            IOError: If an I/O error occurs during the snapshot operation.
            Exception: If any other exception occurs during the snapshot operation.

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B[Log start of snapshot process]
                B --> C{Attempt snapshot}
                C -->|Success| D{Firewall requires upgrade?}
                D -->|No| E[Log snapshot failed, halt upgrade]
                E --> F[Return "errored"]
                D -->|Yes| G[Log snapshot success]
                G --> H[Return "completed"]
                C -->|Failure| I{Max retries reached?}
                I -->|No| J[Log snapshot error]
                J --> K[Wait for retry interval]
                K --> C
                I -->|Yes| L[Log snapshot failure after max retries]
                L --> M[Return "errored"]
            ```
        """

        self.update_current_step(
            f"{device['db_device'].hostname}: Take {snapshot_type.capitalize()} snapshot of the network information"
        )

        # Log the start of the snapshot process
        self.logger.log_task(
            action="start",
            message=f"{device['db_device'].hostname}: Performing snapshot of network state information {snapshot_type}-"
            "upgrade.",
        )

        # Attempt to take the snapshot
        self.snapshot_attempt = 0
        self.snapshot_succeeded = False
        while (
            self.snapshot_attempt < self.profile["snapshots"]["retry_interval"]
            and not self.snapshot_succeeded
        ):
            # Make a snapshot attempt
            try:
                # Execute the snapshot operation
                self.run_assurance(
                    device=device,
                    operation_type="state_snapshot",
                    snapshot_type=snapshot_type,
                )

            # Catch specific and general exceptions
            except (AttributeError, IOError, Exception) as error:
                # Log the snapshot error message
                self.logger.log_task(
                    action="error",
                    message=f"{device['db_device'].hostname}: Snapshot attempt failed with error: {error}. "
                    f"Retrying after {self.profile['snapshots']['retry_interval']} seconds.",
                )
                self.logger.log_task(
                    action="working",
                    message=f"{device['db_device'].hostname}: Waiting for {self.profile['snapshots']['retry_interval']}"
                    f" seconds before retrying snapshot.",
                )

                # Wait before retrying the snapshot
                time.sleep(self.profile["snapshots"]["retry_interval"])

                # Increment the snapshot attempt number
                self.snapshot_attempt += 1

    def update_current_step(self, step_name: str):
        """
        Update the current_step of the associated Job.

        Args:
            step_name (str): The name of the current step.
        """
        try:
            with transaction.atomic():
                job = Job.objects.select_for_update().get(task_id=self.job_id)
                job.current_step = step_name
                job.updated_at = timezone.now()
                job.save()

        except Job.DoesNotExist:
            self.logger.log_task(
                action="error",
                message=f"Failed to update current step. Job with ID {self.job_id} not found.",
            )
        except Exception as e:
            self.logger.log_task(
                action="error", message=f"Error updating current step: {str(e)}"
            )
