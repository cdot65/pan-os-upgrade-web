# backend/panosupgradeweb/scripts/panos_upgrade/app.py
import time

from panosupgradeweb.models import Device
from panosupgradeweb.scripts.logger import PanOsUpgradeLogger
from panosupgradeweb.scripts.utilities import parse_version
from .upgrade import PanosUpgrade

# Create an instance of the custom logger
job_logger = PanOsUpgradeLogger("pan-os-upgrade-upgrade")


def main(
    author_id: int,
    device_uuid: str,
    dry_run: bool,
    job_id: str,
    profile_uuid: str,
    target_version: str,
) -> str:
    """
    Main function to perform PAN-OS upgrade on a firewall device.

    This function orchestrates the PAN-OS upgrade process for a firewall device. It checks the device's HA status,
    prepares the upgrade devices list, performs compatibility checks, downloads the required software versions,
    handles HA scenarios, and performs pre-upgrade snapshots.

    Args:
        author_id (int): The ID of the author initiating the upgrade job.
        device_uuid (str): The UUID of the firewall device to be upgraded.
        dry_run (bool): Flag indicating whether to perform a dry run (True) or actual upgrade (False).
        job_id (str): The ID of the upgrade job.
        profile_uuid (str): The UUID of the upgrade profile.
        target_version (str): The target PAN-OS version for the upgrade job.

    Returns:
        str: The status of the upgrade process ("completed", "skipped", or "errored").

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B{Is device primary in HA pair?}
            B -->|Yes| C[Skip upgrade]
            B -->|No| D[Prepare upgrade devices list]
            D --> E{Perform upgrade for passive, active-secondary, or standalone devices}
            E --> F[Parse current and target versions]
            F --> G[Check upgrade compatibility]
            G --> H{Software versions available?}
            H -->|Yes| I[Download base and target versions]
            H -->|No| J[Return "errored"]
            I --> K{Device in HA pair?}
            K -->|Yes| L[Handle HA scenarios]
            K -->|No| M[Perform pre-upgrade snapshot]
            L --> M
            M --> N{Perform upgrade for active or active-primary devices}
            N --> O[Check upgrade availability]
            O --> P{Device in HA pair?}
            P -->|Yes| Q[Handle HA scenarios]
            P -->|No| R[Ensure target version is downloaded]
            Q --> R
            R --> S[Perform pre-upgrade snapshot]
            S --> T{Device suspended?}
            T -->|Yes| U[Skip upgrade]
            T -->|No| V[Return "completed"]
        ```
    """

    # Create a new instance of the PanosUpgrade class
    upgrade_job = PanosUpgrade(job_id)

    # Log the start of the PAN-OS upgrade process
    upgrade_job.logger.log_task(
        action="report",
        message=f"Running PAN-OS upgrade for device: {device_uuid}, executed by author id: {author_id} "
        f"Using the profile {profile_uuid} to upgrade PAN-OS to {target_version}",
    )

    # Check if the device is the primary device in an HA pair, and if so, skip the upgrade
    try:
        targeted_device = Device.objects.get(uuid=device_uuid)

        # Check if the device is the active/primary device in an HA pair, and if so, skip the upgrade
        if targeted_device.ha_enabled and targeted_device.local_state in [
            "active",
            "active-primary",
        ]:
            # Log that the upgrade can only be initiated by the workflow to upgrade the HA peer firewall
            upgrade_job.logger.log_task(
                action="report",
                message=f"{targeted_device.hostname}: Device is the primary device in an HA pair. The upgrade of this "
                "device can only be initiated by the workflow to upgrade the HA passive/secondary peer firewall.",
            )

            # Skip the upgrade process for the primary device in an HA pair
            return "skipped"

    # Gracefully exit if the device is not found in the database
    except Exception as e:
        # Log the error message if the device is not found in the database
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error checking HA status of firewall devices: {str(e)}",
        )

    # This function retrieves the device and profile objects based on the provided UUIDs and assigns the role of
    # the devices to the class object (primary / secondary / standalone). It handles both Panorama-managed and
    # standalone firewalls. If the device is in an HA pair, it also adds the peer firewall to the upgrade list.
    try:
        upgrade_job.assign_upgrade_devices(
            device_uuid=device_uuid,
            profile_uuid=profile_uuid,
        )

    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error preparing upgrade devices: {str(e)}",
        )

    # This section targets the secondary firewall, if it exists, and will gracefully exit the upgrade workflow if it
    # should be within a 'suspended' state, then skip the upgrade workflow.
    if upgrade_job.secondary_device is not None:
        try:
            # Target the secondary devices within an HA pair and refresh the HA state using the
            # `show_highavailability_state()` method
            upgrade_job.get_ha_status(device=upgrade_job.secondary_device["pan_device"])

            # Skip the upgrade process for devices that are suspended
            if upgrade_job.ha_details["result"]["group"]:
                if (
                    upgrade_job.ha_details["result"]["group"]["local-info"]["state"]
                    == "suspended"
                ):
                    # Log the message to the console
                    upgrade_job.logger.log_task(
                        action="report",
                        message=f"{upgrade_job.secondary_device['db_device'].hostname}: Target device is in a HA "
                        "suspended state, skipping upgrade_job.",
                    )

                    # Raise an exception to skip the upgrade process
                    return "errored"

                elif (
                    upgrade_job.ha_details["result"]["group"]["peer-info"]["state"]
                    == "suspended"
                ):
                    # Log the message to the console
                    upgrade_job.logger.log_task(
                        action="report",
                        message=f"{upgrade_job.secondary_device['db_device'].hostname}: Peer device is in a HA "
                        "suspended state, skipping upgrade_job.",
                    )

                    # Raise an exception to skip the upgrade process
                    return "errored"

            elif upgrade_job.ha_details["result"]["local-info"]["state"] == "suspended":
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="report",
                    message=f"{upgrade_job.secondary_device['db_device'].hostname}: Target device is in a HA "
                    "suspended state, skipping upgrade_job.",
                )

                # Raise an exception to skip the upgrade process
                return "errored"

            elif upgrade_job.ha_details["result"]["peer-info"]["state"] == "suspended":
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="report",
                    message=f"{upgrade_job.secondary_device['db_device'].hostname}: Peer device is in a HA "
                    "suspended state, skipping upgrade_job.",
                )

                # Raise an exception to skip the upgrade process
                return "errored"

        # General exception handling
        except Exception as e:
            upgrade_job.logger.log_task(
                action="error",
                message=f"Error determining the HA status of the secondary firewall: {str(e)}",
            )
            return "errored"

    # Set the target_device to be either the secondary or standalone device
    targeted_device = (
        upgrade_job.secondary_device
        if upgrade_job.secondary_device
        else upgrade_job.standalone_device
    )

    # This section takes a version string in the format "major.minor[.maintenance[-h|-c|-b]hotfix][.xfr]"
    # and returns a tuple of four integers representing the major, minor, maintenance, and hotfix parts
    # of the version.
    try:
        # Parse the targeted version string into its major, minor, maintenance, and hotfix.
        upgrade_job.version_target_parsed = parse_version(version=target_version)

        if upgrade_job.secondary_device is not None:
            # Parse the device's current version string into its major, minor, maintenance, and hotfix.
            upgrade_job.version_local_parsed = parse_version(
                version=upgrade_job.secondary_device["db_device"].sw_version
            )

            # Parse the targeted version string into its major, minor, maintenance, and hotfix.
            upgrade_job.version_peer_parsed = parse_version(
                version=upgrade_job.primary_device["db_device"].sw_version,
            )

            # Log the target version sliced object representing the target PAN-OS version
            upgrade_job.logger.log_task(
                action="report",
                message=f"{upgrade_job.secondary_device['db_device'].hostname}: Device is currently running "
                f"{upgrade_job.version_local_parsed} and the targeted PAN-OS upgrade version is "
                f"{upgrade_job.version_target_parsed}. Peer firewall is running {upgrade_job.version_peer_parsed}.",
            )

        else:
            # Parse the device's current version string into its major, minor, maintenance, and hotfix.
            upgrade_job.version_local_parsed = parse_version(
                version=upgrade_job.standalone_device["db_device"].sw_version
            )
            # Log the target version sliced object representing the target PAN-OS version
            upgrade_job.logger.log_task(
                action="report",
                message=f"{upgrade_job.standalone_device['db_device'].hostname}: Device is currently running "
                f"{upgrade_job.version_local_parsed} and the targeted PAN-OS upgrade version is "
                f"{upgrade_job.version_target_parsed}. Device is not in an HA pair.",
            )

    # General exception handling
    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error parsing the current and/or targeted upgrade version of PAN-OS: {str(e)}",
        )
        return "errored"

    # This section compares the current version of a firewall with the target version to determine
    # if an upgrade is necessary. If an upgrade is required, it logs the appropriate message.
    # If no upgrade is required or a downgrade attempt is detected, it logs the corresponding
    # messages and exits the upgrade workflow.
    try:
        # Check if the specified version is older than the current version
        upgrade_required = upgrade_job.determine_upgrade(
            current_version=upgrade_job.version_local_parsed,
            hostname=targeted_device["db_device"].hostname,
            target_version=upgrade_job.version_target_parsed,
        )

        # Gracefully exit if the firewall does not require an upgrade to target version
        if not upgrade_required:
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: It was determined that this device is not "
                f"suitable to kick off an upgrade workflow to version {target_version}.",
            )
            return "errored"

    # General exception handling
    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error determining if the device is ready to be upgraded to PAN-OS version "
            f"{target_version}: {str(e)}",
        )
        return "errored"

    # This section compares the current version and target version of a firewall in an HA pair
    # to determine if the upgrade is compatible.
    try:
        # Check if the upgrade is compatible with the HA setup
        if targeted_device["db_device"].ha_enabled:
            # Perform HA compatibility check for the target version
            upgrade_compatible = upgrade_job.check_ha_compatibility(
                current_version=upgrade_job.version_local_parsed,
                hostname=targeted_device["db_device"].hostname,
                target_version=upgrade_job.version_target_parsed,
            )

            # Gracefully exit if the firewall does not require an upgrade to target version
            if not upgrade_compatible:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{targeted_device['db_device'].hostname}: {target_version} is not an compatible upgrade "
                    f"path for the current release used in the H"
                    f"A setup {targeted_device['db_device'].sw_version}.",
                )

                # Return an error status
                return "errored"

    # General exception handling
    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error determining if the devices in an HA pair are compatible for the target PAN-OS version "
            f"{target_version}: {str(e)}",
        )
        return "errored"

    # This section issues a request on the remote device to pull down the latest version of software from
    # the customer service portal.
    try:
        # Check if a software update is available for the device
        available_versions = upgrade_job.software_available_check(
            device=targeted_device["pan_device"],
            target_version=target_version,
        )

        # Gracefully exit if the target version is not available
        if not available_versions:
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: Target version {target_version} is not available.",
            )
            return "errored"

    # General exception handling
    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error determining if the PAN-OS version is available for download"
            f"{target_version}: {str(e)}",
        )
        return "errored"

    # The section determines if the targeted PAN-OS version's base image is on the device already,
    # if not it will initiate a download of the base image.
    try:
        # Create a base version key for the target version
        base_version_key = f"{upgrade_job.version_target_parsed[0]}.{upgrade_job.version_target_parsed[1]}.0"

        # Log the message to the console
        upgrade_job.logger.log_task(
            action="success",
            message=f"{targeted_device['db_device'].hostname}: Checking to see if {target_version}'s base image "
            f"{base_version_key} is available",
        )

        # Check if the base image is not downloaded
        if not targeted_device["pan_device"].software.versions[base_version_key][
            "downloaded"
        ]:
            # If the "downloaded" key is not set to "downloading"
            if (
                targeted_device["pan_device"].software.versions[base_version_key][
                    "downloaded"
                ]
                != "downloading"
            ):
                # Special log if the device is in HA mode:
                if targeted_device["db_device"].ha_enabled:
                    # Log the message to the console
                    upgrade_job.logger.log_task(
                        action="start",
                        message=f"{targeted_device['db_device'].hostname}: Downloading base image {base_version_key} "
                        f"for target version {target_version}, will sync to HA peer.",
                    )

                # Non-HA log message for standalone devices
                else:
                    # Log the message to the console
                    upgrade_job.logger.log_task(
                        action="start",
                        message=f"{targeted_device['db_device'].hostname}: Downloading base image {base_version_key} "
                        f"for target version {target_version}.",
                    )

                # Retry loop for downloading the base image
                for attempt in range(upgrade_job.max_retries):
                    # Log the message to the console
                    upgrade_job.logger.log_task(
                        action="success",
                        message=f"{targeted_device['db_device'].hostname}: Downloading PAN-OS version "
                        f"{base_version_key} on the device",
                    )

                    # Download the base image for the target version
                    downloaded = PanosUpgrade.software_download(
                        device=targeted_device["pan_device"],
                        target_version=base_version_key,
                    )

                    # Break out of while loop if download was successful
                    if downloaded:
                        # Log the download success message
                        upgrade_job.logger.log_task(
                            action="success",
                            message=f"{targeted_device['db_device'].hostname}: Base image {base_version_key} "
                            f"downloaded for target version {target_version}.",
                        )

                        # Log the waiting message
                        upgrade_job.logger.log_task(
                            action="success",
                            message=f"{targeted_device['db_device'].hostname}: Waiting {upgrade_job.retry_interval} "
                            f"seconds to let the base image {base_version_key} load into the software manager "
                            f"before downloading {target_version}.",
                        )

                        # Wait for the base image to load into the software manager
                        time.sleep(upgrade_job.retry_interval)

                        break

                    # Retry downloading the base image if it failed
                    elif not downloaded:
                        # Log the download failure and wait before retrying
                        if attempt < upgrade_job.max_retries - 1:
                            upgrade_job.logger.log_task(
                                action="error",
                                message=f"{targeted_device['db_device'].hostname}: Failed to download base image "
                                f"{base_version_key} for target version {target_version}. "
                                f"Retrying after {upgrade_job.retry_interval} seconds.",
                            )
                            time.sleep(upgrade_job.retry_interval)

                        # Return "errored" if the download failed after multiple attempts
                        else:
                            return "errored"

            # If the status is "downloading", then we can deduce that multiple executions are being
            # performed, so we should return an "errored" to prevent conflicts
            else:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{targeted_device['db_device'].hostname}: Base image {base_version_key} is already "
                    f"downloading, assuming that there are multiple upgrade executions taking "
                    f"place. Skipping upgrade_job.",
                )

                # Return "errored" to prevent conflicts
                return "errored"

        # Since the base image is already downloaded, simply log message to console
        else:
            # Log the message to the console
            upgrade_job.logger.log_task(
                action="success",
                message=f"{targeted_device['db_device'].hostname}: Base image {base_version_key} was found to be "
                f"already downloaded on the local device, so we are skipping the download process.",
            )

    # General exception handling
    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error downloading the base image: {str(e)} "
            f"{target_version}: {str(e)}",
        )

    # The section determines if the targeted PAN-OS version's image is on the device already,
    # if not it will initiate a download of the target image.
    try:
        # Log the message to the console
        upgrade_job.logger.log_task(
            action="success",
            message=f"{targeted_device['db_device'].hostname}: Checking to see if the target image {target_version} "
            "is available.",
        )

        # Check if the target image is not downloaded or in downloading state
        if not targeted_device["pan_device"].software.versions[target_version][
            "downloaded"
        ]:
            # If the "downloaded" key is not set to "downloading"
            if (
                targeted_device["pan_device"].software.versions[target_version][
                    "downloaded"
                ]
                != "downloading"
            ):
                # Special log if the device is in HA mode:
                if targeted_device["db_device"].ha_enabled:
                    # Log the message to the console
                    upgrade_job.logger.log_task(
                        action="start",
                        message=f"{targeted_device['db_device'].hostname}: Downloading target image {target_version}, "
                        "will sync to HA peer.",
                    )

                # Non-HA log message for standalone devices
                else:
                    # Log the message to the console
                    upgrade_job.logger.log_task(
                        action="start",
                        message=f"{targeted_device['db_device'].hostname}: Downloading target image {target_version}.",
                    )

                # Retry loop for downloading the target image
                for attempt in range(upgrade_job.max_retries):
                    # Download the target image
                    downloaded = PanosUpgrade.software_download(
                        device=targeted_device["pan_device"],
                        target_version=target_version,
                    )

                    # Break out of while loop if download was successful
                    if downloaded:
                        # Log the download success message
                        upgrade_job.logger.log_task(
                            action="success",
                            message=f"{targeted_device['db_device'].hostname}: Target image {target_version} is on "
                            "the device.",
                        )

                        # Log the waiting message
                        upgrade_job.logger.log_task(
                            action="success",
                            message=f"{targeted_device['db_device'].hostname}: Waiting {upgrade_job.retry_interval} "
                            "seconds to let the target image load into the software manager before proceeding.",
                        )

                        # Wait for the base image to load into the software manager
                        time.sleep(upgrade_job.retry_interval)

                        break

                    # Retry downloading the target image if it failed
                    elif not downloaded:
                        # Log the download failure and wait before retrying
                        if attempt < upgrade_job.max_retries - 1:
                            upgrade_job.logger.log_task(
                                action="error",
                                message=f"{targeted_device['db_device'].hostname}: Failed to download target image "
                                f"{target_version}. Retrying after {upgrade_job.retry_interval} seconds.",
                            )
                            time.sleep(upgrade_job.retry_interval)

                        # Return "errored" if the download failed after multiple attempts
                        else:
                            return "errored"

                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="success",
                    message=f"{targeted_device['db_device'].hostname}: Target image {target_version} is on the device",
                )

            # If the status is "downloading", then we can deduce that multiple executions are being
            # performed, so we should return an "errored" to prevent conflicts
            else:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{targeted_device['db_device'].hostname}: Target image {target_version} is already "
                    f"downloading, assuming that there are multiple upgrade executions taking "
                    f"place. Skipping upgrade_job.",
                )

                # Return "errored" to prevent conflicts
                return "errored"

        # Since the target image is already downloaded, simply log message to console
        else:
            # Log the message to the console
            upgrade_job.logger.log_task(
                action="success",
                message=f"{targeted_device['db_device'].hostname}: Target image {target_version} is already "
                f"downloaded on the target firewall, skipping the process of downloading again.",
            )

    # General exception handling
    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error occurred when downloading the targeted upgrade PAN-OS version "
            f"{target_version}: {str(e)}",
        )

    # Handle HA scenarios for devices that are part of an HA pair, where we check to see if the HA config
    # has been successfully synced between the two firewalls. Next we compare the versions between the two
    # firewall appliances
    try:
        if targeted_device["db_device"].ha_enabled:

            # If the current device is in suspended HA state
            if (
                upgrade_job.ha_details["result"]["group"]["local-info"]["state"]
                == "suspended"
            ):
                # Log message to console
                upgrade_job.logger.log_task(
                    action="report",
                    message=f"{targeted_device['db_device'].hostname}: Target device is in a suspended HA state",
                )

                # Return "errored", gracefully exiting the upgrade's execution
                return "errored"

            # Wait for HA synchronization to complete
            while (
                upgrade_job.ha_details["result"]["group"]["running-sync"]
                != "synchronized"
            ):
                # Increment the attempt number for the PAN-OS upgrade
                attempt = 0

                # HA synchronization process
                if attempt < targeted_device["profile"].max_snapshot_tries:
                    # Log the attempt number
                    upgrade_job.logger.log_task(
                        action="search",
                        message=f"{targeted_device['db_device'].hostname}: Attempt "
                        f"{attempt + 1}/{targeted_device['profile'].max_snapshot_tries} to get HA status.",
                    )

                    # Check if the HA synchronization is complete
                    if (
                        upgrade_job.ha_details["result"]["group"]["running-sync"]
                        == "synchronized"
                    ):
                        # Log the HA synchronization status
                        upgrade_job.logger.log_task(
                            action="success",
                            message=f"{targeted_device['db_device'].hostname}: HA synchronization complete.",
                        )

                        # break out of the loop
                        break

                    # Check if the HA synchronization is still in progress
                    else:
                        # Log the HA synchronization status
                        upgrade_job.logger.log_task(
                            action="working",
                            message=f"{targeted_device['db_device'].hostname}: HA synchronization still in progress.",
                        )

                        # Wait for HA synchronization
                        time.sleep(targeted_device["profile"].snapshot_retry_interval)

                        # Increment the attempt number
                        attempt += 1

                # If the HA synchronization fails after multiple attempts
                else:
                    # Log the HA synchronization status
                    upgrade_job.logger.log_task(
                        action="error",
                        message=f"{targeted_device['db_device'].hostname}: HA synchronization failed after attempting "
                        f"for a total of {targeted_device['profile'].max_snapshot_tries} attempts.",
                    )

                    # Return an error status
                    return "errored"

            # Compare the local and peer PAN-OS versions
            version_comparison = upgrade_job.compare_versions(
                hostname=targeted_device["db_device"],
                local_version_sliced=upgrade_job.version_local_parsed,
                peer_version_sliced=upgrade_job.version_peer_parsed,
            )

            # Log the version comparison result
            upgrade_job.logger.log_task(
                action="report",
                message=f"{targeted_device['db_device'].hostname}: Peer version comparison: {version_comparison}",
            )

            # If the firewall is running an older version than its peer devices
            if version_comparison == "older" or version_comparison == "equal":
                # Determine if we are running in Dry Run mode
                if not dry_run:
                    # Log message to console
                    upgrade_job.logger.log_task(
                        action="start",
                        message=f"{targeted_device['db_device'].hostname}: Suspending the HA state of device",
                    )

                    # Suspend HA state of the active device
                    upgrade_job.suspend_ha_device(device=targeted_device)

                else:
                    upgrade_job.logger.log_task(
                        action="skipped",
                        message=f"{targeted_device['db_device'].hostname}: Dry run mode enabled. Skipping HA state "
                        f"suspension.",
                    )

                    # Return "errored", gracefully exiting the upgrade's execution
                    return "errored"

            # If the firewall is running a newer version than its peer devices
            elif version_comparison == "newer":
                # Log message to console
                upgrade_job.logger.log_task(
                    action="report",
                    message=f"{targeted_device['db_device'].hostname}: Target device is on a newer version",
                )

                # Return "errored", gracefully exiting the upgrade's execution
                return "errored"

    # General exception handling
    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error occurred when validating the HA status of device: {str(e)} "
            f"{target_version}: {str(e)}",
        )

    # Snapshot the firewall device before the upgrade process
    try:

        # Log the start of the snapshot process
        upgrade_job.logger.log_task(
            action="start",
            message=f"{targeted_device['db_device'].hostname}: Performing snapshot of network state information.",
        )

        # Initialize the pre-upgrade snapshot
        attempt = 0
        pre_snapshot = None

        # Attempt to take the pre-upgrade snapshot
        while attempt < upgrade_job.max_retries and pre_snapshot is None:
            # Make a snapshot attempt
            try:
                # Execute the snapshot operation
                pre_snapshot = upgrade_job.run_assurance(
                    device=targeted_device,
                    operation_type="state_snapshot",
                )

                # Log the snapshot success message
                upgrade_job.logger.log_task(
                    action="save",
                    message=f"{targeted_device['db_device'].hostname}: Snapshot successfully created.",
                )

            # Catch specific and general exceptions
            except (AttributeError, IOError, Exception) as error:
                # Log the snapshot error message
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{targeted_device['db_device'].hostname}: Snapshot attempt failed with error: {error}. "
                    f"Retrying after {upgrade_job.retry_interval} seconds.",
                )
                upgrade_job.logger.log_task(
                    action="working",
                    message=f"{targeted_device['db_device'].hostname}: Waiting for {upgrade_job.retry_interval} seconds"
                    f" before retrying snapshot.",
                )

                # Wait before retrying the snapshot
                time.sleep(upgrade_job.retry_interval)

                # Increment the snapshot attempt number
                attempt += 1

        # If the pre-upgrade snapshot fails after multiple attempts
        if pre_snapshot is None:
            # Log the snapshot error message
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: Failed to create snapshot after trying a total of "
                f"{upgrade_job.max_retries} attempts.",
            )

        # Log the pre-upgrade snapshot message
        upgrade_job.logger.log_task(
            action="report",
            message=f"{targeted_device['db_device'].hostname}: Pre-upgrade snapshot {pre_snapshot}",
        )

    # General exception handling
    except Exception as e:
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error occurred when performing the snapshot of the network state of device: {str(e)} ",
        )

    # TODO: Readiness Checks
    # TODO: Upgrade
    # TODO: Post Upgrade Snapshots
    # TODO: PDF Report Generation
    # TODO: Active Firewall Upgrades
