import time
from typing import Dict, Optional, Tuple, Union

# Palo Alto Networks SDK imports
from panos.firewall import Firewall
from panos.panorama import Panorama
from panos.errors import PanDeviceXapiError

# Palo Alto Networks Assurance imports
from panos_upgrade_assurance.check_firewall import CheckFirewall
from panos_upgrade_assurance.firewall_proxy import FirewallProxy

# pan-os-upgrade imports
from pan_os_upgrade.components.utilities import flatten_xml_to_dict
from pan_os_upgrade.components.assurance import AssuranceOptions

# pan-os-upgrade-web imports
from panosupgradeweb.models import (
    ContentVersion,
    Device,
    Job,
    License,
    NetworkInterface,
    Profile,
    Snapshot,
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
        max_retries (int): The maximum number of retries for certain operations.
        retry_interval (int): The interval (in seconds) between retries.
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
        - check_ha_compatibility(self, current_version: Tuple, hostname: str, target_version: Tuple) -> bool: Check the
        compatibility of upgrading a firewall in an HA pair to a target version.
        - compare_versions(self, local_version_sliced: Tuple, hostname: str, peer_version_sliced: Tuple) -> str: Compare
        two version tuples and determine their relative order.
        - determine_upgrade(self, hostname: str, current_version: Tuple, target_version: Tuple) -> bool: Determine if a
        firewall requires an upgrade based on the current and target versions.
        - get_ha_status(self, device: Firewall) -> Optional[Dict]: Retrieve the deployment information and HA status of
        a firewall device.
        - run_assurance(self, device: Dict, operation_type: str) -> Any: Run assurance checks or snapshots on a firewall
        device.
        - software_available_check(self, device: Union[Firewall, Panorama], target_version: str) -> Optional[Dict]:
        Check if a software update to the target version is available and compatible.
        - software_download(self, device: Union[Firewall, Panorama], target_version: str) -> bool: Download the target
        software version to the firewall device.
        - suspend_ha_device(self, device: Dict) -> bool: Suspend the active device in a high-availability (HA) pair.
    """

    def __init__(
        self,
        job_id: str,
    ):
        self.job_id = job_id
        self.logger = PanOsUpgradeLogger("pan-os-upgrade-upgrade")
        self.logger.set_job_id(job_id)
        self.max_retries = 3
        self.retry_interval = 60
        self.primary_device = None
        self.secondary_device = None
        self.standalone_device = None
        self.ha_details = None
        self.version_local_parsed = None
        self.version_peer_parsed = None
        self.version_target_parsed = None

    def assign_device(self, device_dict):
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
                    api_username=profile.pan_username,
                    api_password=profile.pan_password,
                )
                pan = Panorama(
                    hostname=(
                        each.panorama_ipv4_address
                        if each.panorama_ipv4_address
                        else each.ipv6_address
                    ),
                    api_username=profile.pan_username,
                    api_password=profile.pan_password,
                )
                pan.add(firewall)
            else:
                firewall = Firewall(
                    hostname=each.ipv4_address,
                    username=profile.pan_username,
                    password=profile.pan_password,
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
                assigned_as = self.assign_device(device_dict=device_dict)

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
    ) -> bool:
        """
        Check the compatibility of upgrading a firewall in an HA pair to a target version.

        This function compares the current version and target version of a firewall in an HA pair
        to determine if the upgrade is compatible. It checks for the following scenarios:
        - If the major upgrade is more than one release apart
        - If the upgrade is within the same major version but the minor upgrade is more than one release apart
        - If the upgrade spans exactly one major version but also increases the minor version

        Args:
            self: The instance of the class containing this method.
            current_version (Tuple[int, int, int, int]): The current version of the firewall in the format
            (major, minor, patch, build).
            hostname (str): The hostname of the firewall device.
            target_version (Tuple[int, int, int, int]): The target version for the upgrade in the format
            (major, minor, patch, build).

        Returns:
            bool: True if the upgrade
        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B{Major upgrade more than one release apart?}
                B -->|Yes| C[Log warning and return False]
                B -->|No| D{Within same major version and minor upgrade more than one release apart?}
                D -->|Yes| E[Log warning and return False]
                D -->|No| F{Spans exactly one major version and increases minor version?}
                F -->|Yes| G[Log warning and            F -->|No| H[Log compatibility check success and return True]
            ```
        """

        # Check if the major upgrade is more than one release apart
        if target_version[0] - current_version[0] > 1:
            self.logger.log_task(
                action="warning",
                message=f"{hostname}: Upgrading firewalls in an HA pair to a version that is more "
                f"than one major release apart may cause compatibility issues.",
            )
            return False

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
            return False

        # Check if the upgrade spans exactly one major version but also increases the minor version
        elif target_version[0] - current_version[0] == 1 and target_version[1] > 0:
            self.logger.log_task(
                action="warning",
                message=f"{hostname}: Upgrading firewalls in an HA pair to a version that spans "
                f"more than one major release or increases the minor version beyond the first in the next "
                f"major release may cause compatibility issues.",
            )
            return False

        # Log compatibility check success
        self.logger.log_task(
            action="success",
            message=f"{hostname}: The target version is compatible with the current version.",
        )
        return True

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
    ) -> bool:
        """
        Determine if a firewall requires an upgrade based on the current and target versions.

        This function compares the current version of a firewall with the target version to determine
        if an upgrade is necessary. It logs the current and target versions and checks if the current
        version is less than the target version. If an upgrade is required, it logs the appropriate
        message and returns True. If no upgrade is required or a downgrade attempt is detected, it
        logs the corresponding messages, halts the upgrade, and returns False.

        Args:
            hostname (str): The hostname of the firewall device.
            current_version (Tuple[int, int, int, int]): The current version of the firewall as a tuple
                in the format (major, minor, patch, maintenance).
            target_version (Tuple[int, int, int, int]): The target version for the upgrade as a tuple
                in the format (major, minor, patch, maintenance).
        Returns:
            bool: True if an upgrade is required, False otherwise.

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B[Log current and target versions]
                B --> C{Is current version less than target version?}
                C -->|Yes| D[Log upgrade required message]
                C -->|No| E[Log no upgrade required or downgrade attempt detected]
                D --> F[Return True]
                E --> G[Log halting upgrade mes            G --> H[Return False]
            ```
        """

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
                action="start",
                message=f"{hostname}: Upgrade required from {current_version} to {target_version}",
            )
            return True
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
            return False

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

        # Get the deployment type using show_highavailability_state()
        deployment_type = device.show_highavailability_state()

        # Check if HA details are available
        if deployment_type[1]:
            # Flatten the XML to a dictionary if HA details are available
            self.ha_details = flatten_xml_to_dict(element=deployment_type[1])

    # def perform_readiness_checks(
    #     file_path: str,
    #     firewall: Firewall,
    #     hostname: str,
    #     settings_file_path: Path,
    # ) -> None:
    #     """
    #     Conducts a set of predefined readiness checks on a specified Palo Alto Networks Firewall to verify its
    #     preparedness for an upgrade operation.
    #
    #     This function systematically executes a series of checks on the specified firewall, evaluating various
    #     aspects such as configuration status, licensing validity, software version compatibility, and more, to
    #     ascertain its readiness for an upgrade. The outcomes of these checks are meticulously compiled into a
    #     detailed JSON report, which is then saved to the specified file path. The scope of checks performed can
    #     be tailored through configurations in the `settings.yaml` file, providing the flexibility to adapt the
    #     checks to specific operational needs or preferences.
    #
    #     Parameters
    #     ----------
    #     firewall : Firewall
    #         An instance of the Firewall class, properly initialized with necessary authentication details and
    #         network connectivity to the target firewall device.
    #     hostname : str
    #         A string representing the hostname or IP address of the firewall, utilized for logging and
    #         identification purposes within the process.
    #     file_path : str
    #         The designated file path where the JSON-formatted report summarizing the results of the readiness
    #         checks will be stored. The function ensures the existence of the specified directory, creating it
    #         if necessary.
    #
    #     Raises
    #     ------
    #     IOError
    #         Signals an issue with writing the readiness report to the specified file path, potentially due to
    #         file access restrictions or insufficient disk space, warranting further investigation.
    #
    #     Examples
    #     --------
    #     Executing readiness checks for a firewall and saving the results:
    #         >>> firewall_instance = Firewall(hostname='192.168.1.1', api_username='admin', api_password='admin')
    #         >>> perform_readiness_checks(firewall_instance, 'firewall1', '/path/to/firewall1_readiness_report.json')
    #         # This command initiates the readiness checks on the specified firewall and saves the generated report
    #         # to the given file path.
    #
    #     Notes
    #     -----
    #     - The execution of readiness checks is a pivotal preliminary step in the upgrade process, designed to
    #       uncover and address potential impediments, thereby facilitating a seamless and successful upgrade.
    #     - The set of checks to be conducted can be customized via the `settings.yaml` file. If this file is
    #       present and contains specific configurations under the `readiness_checks.customize` key, those
    #       configurations will dictate the checks to be performed. In the absence of such custom configurations,
    #       a default set of checks, determined by the `enabled_by_default` attribute within the AssuranceOptions
    #       class, will be applied.
    #     """
    #
    #     # Load settings if the file exists
    #     if settings_file_path.exists():
    #         with open(settings_file_path, "r") as file:
    #             settings = yaml.safe_load(file)
    #
    #         # Determine readiness checks to perform based on settings
    #         if settings.get("readiness_checks", {}).get("customize", False):
    #             # Extract checks where value is True
    #             selected_checks = [
    #                 check
    #                 for check, enabled in settings.get("readiness_checks", {})
    #                 .get("checks", {})
    #                 .items()
    #                 if enabled
    #             ]
    #         else:
    #             # Select checks based on 'enabled_by_default' attribute from AssuranceOptions class
    #             selected_checks = [
    #                 check
    #                 for check, attrs in AssuranceOptions.READINESS_CHECKS.items()
    #                 if attrs.get("enabled_by_default", False)
    #             ]
    #     else:
    #         # Select checks based on 'enabled_by_default' attribute from AssuranceOptions class
    #         selected_checks = [
    #             check
    #             for check, attrs in AssuranceOptions.READINESS_CHECKS.items()
    #             if attrs.get("enabled_by_default", False)
    #         ]
    #
    #
    #     readiness_check = run_assurance(
    #         actions=selected_checks,
    #         firewall=firewall,
    #         hostname=hostname,
    #         operation_type="readiness_check",
    #     )
    #
    #     # Check if a readiness check was successfully created
    #     if isinstance(readiness_check, ReadinessCheckReport):
    #         logging.info(
    #             f"{get_emoji(action='success')} {hostname}: Readiness Checks completed"
    #         )
    #         readiness_check_report_json = readiness_check.model_dump_json(indent=4)
    #         logging.debug(
    #             f"{get_emoji(action='save')} {hostname}: Readiness Check Report: {readiness_check_report_json}"
    #         )
    #
    #         ensure_directory_exists(file_path=file_path)
    #
    #         with open(file_path, "w") as file:
    #             file.write(readiness_check_report_json)
    #
    #     else:
    #         logging.error(
    #             f"{get_emoji(action='error')} {hostname}: Failed to create readiness check"
    #         )

    def run_assurance(
        self,
        device: Dict,
        operation_type: str,
    ) -> any:
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
                C --> D[Get enabled snapshot actions from device profile]
                D --> E[Validate snapshot actions]
                E -->|Invalid action| F[Log error and return None]
                E -->|Valid actions| G[Run snapshots using CheckFirewall]
                G --> H{Snapshots successful?}
                H -->|No| I[Log error and return None]
                H -->|Yes| J[Log snapshot results and return results]
                B -->|Other| K[Log error and return None]
            ```
        """

        # Setup Firewall client
        proxy_firewall = FirewallProxy(device["pan_device"])
        checks_firewall = CheckFirewall(proxy_firewall)

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

            # Create a list of action names where the corresponding value is True
            enabled_actions = [action for action, enabled in actions.items() if enabled]

            # Validate each enabled action
            for action in enabled_actions:
                if action not in AssuranceOptions.STATE_SNAPSHOTS.keys():
                    return None

            # Run the snapshots using CheckFirewall
            self.logger.log_task(
                action="working",
                message=f"{device['db_device'].hostname}: Running snapshots using CheckFirewall",
            )
            snapshot_results = checks_firewall.run_snapshots(
                snapshots_config=enabled_actions
            )

            if snapshot_results:
                try:
                    # Retrieve the Job object using the job_id
                    job = Job.objects.get(task_id=self.job_id)

                    # Create a new Snapshot instance and associate it with the job and device
                    snapshot = Snapshot.objects.create(
                        job=job,
                        device=device["db_device"],
                        snapshot_type="pre_upgrade",
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
                        for nic_name, nic_status in snapshot_results["nics"].items():
                            NetworkInterface.objects.create(
                                snapshot=snapshot,
                                name=nic_name,
                                status=nic_status,
                            )

                    self.logger.log_task(
                        action="success",
                        message=f"{device['db_device'].hostname}: Snapshot creation completed successfully",
                    )
                    return snapshot_results

                except Job.DoesNotExist:
                    # Log an error message
                    self.logger.log_task(
                        action="error",
                        message=f"{device['db_device'].hostname}: Job with ID {self.job_id} does not exist",
                    )

                    # Return None to indicate that the snapshot creation failed
                    return None

                except Exception as e:
                    # Log the error message
                    self.logger.log_task(
                        action="error",
                        message=f"{device['db_device'].hostname}: Error creating snapshot: {str(e)}",
                    )

                    # Return None to indicate that the snapshot creation failed
                    return None

            else:
                # Log the error and return None
                return None

    @staticmethod
    def software_available_check(
        device: Union[Firewall, Panorama],
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
        6. If the base image is already downloaded or successfully downloaded, returns the available versions.
        7. If the target version is not available or the download fails after multiple attempts, returns None.

        Args:
            device (Union[Firewall, Panorama]): The firewall or Panorama device object.
            target_version (str): The target software version to check for availability and compatibility.

        Returns:
            Optional[Dict]: A dictionary containing the available software versions if the
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

        # Retrieve available versions of PAN-OS
        device.software.check()
        available_versions = device.software.versions

        # Check if the target version is available
        if target_version in available_versions:
            return available_versions

    @staticmethod
    def software_download(
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
