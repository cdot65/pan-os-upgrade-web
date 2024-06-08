# backend/panosupgradeweb/scripts/panos_upgrade/app.py
import time

from celery.exceptions import WorkerLostError

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
        author_id (int): The ID of the author initiating the upgrade.
        device_uuid (str): The UUID of the firewall device to be upgraded.
        dry_run (bool): Flag indicating whether to perform a dry run (True) or actual upgrade (False).
        job_id (str): The ID of the upgrade job.
        profile_uuid (str): The UUID of the upgrade profile.
        target_version (str): The target PAN-OS version for the upgrade.

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
    upgrade = PanosUpgrade(job_id)

    # Log the start of the PAN-OS upgrade process
    upgrade.logger.log_task(
        action="report",
        message=f"Running PAN-OS upgrade for device: {device_uuid}, executed by author id: {author_id} "
        f"Using the profile {profile_uuid} to upgrade PAN-OS to {target_version}",
    )

    # Check if the device is the primary device in an HA pair, and if so, skip the upgrade
    try:
        device = Device.objects.get(uuid=device_uuid)

        # Check if the device is the active/primary device in an HA pair, and if so, skip the upgrade
        if device.ha_enabled and device.local_state in ["active", "active-primary"]:
            # Log that the upgrade can only be initiated by the workflow to upgrade the HA peer firewall
            upgrade.logger.log_task(
                action="report",
                message=f"{device.hostname}: Device is the primary device in an HA pair. The upgrade of this device "
                f"can only be initiated by the workflow to upgrade the HA passive/secondary peer firewall.",
            )

            # Skip the upgrade process for the primary device in an HA pair
            return "skipped"

    # Gracefully exit if the device is not found in the database
    except Exception as e:
        # Log the error message if the device is not found in the database
        upgrade.logger.log_task(
            action="error",
            message=f"Error checking HA status of firewall devices: {str(e)}",
        )

    # This function retrieves the device and profile objects based on the provided UUIDs and creates
    # a list of devices to be upgraded. It handles both Panorama-managed and standalone firewalls.
    # If the device is in an HA pair, it also adds the peer firewall to the upgrade list.
    try:
        upgrade.create_list_of_upgrade_devices(
            device_uuid=device_uuid,
            profile_uuid=profile_uuid,
        )

    except Exception as e:
        upgrade.logger.log_task(
            action="error",
            message=f"Error preparing upgrade devices: {str(e)}",
        )

    # Perform the upgrade process for the passive, active-secondary, or standalone devices
    try:
        for i, each in enumerate(upgrade.upgrade_devices):
            # Set the number of retries and wait time from the profile for downloading the base image
            retry_count = each["profile"].max_download_tries
            wait_time = each["profile"].download_retry_interval
            peer_version_sliced = None

            # Target the passive, active-secondary, or standalone devices for the upgrade process
            if (
                each["db_device"].local_state in ["passive", "active-secondary"]
                or not each["db_device"].ha_enabled
            ):
                # This section uses the `show_highavailability_state()` method to retrieve the deployment type
                # and HA details of the specified firewall device.
                try:
                    ha_details = upgrade.get_ha_status(device=each)

                    # Skip the upgrade process for devices that are suspended
                    if each["db_device"].local_state in ["suspended"]:
                        # Log the message to the console
                        upgrade.logger.log_task(
                            action="report",
                            message=f"{each['db_device'].hostname}: Target device is in a HA suspended state, "
                            "skipping upgrade.",
                        )

                        # Remove the device from the upgrade list
                        upgrade.upgrade_devices.pop(i)

                        # Raise an exception to skip the upgrade process
                        return "errored"

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"Error determining the HA status of the firewall: {str(e)}",
                    )
                    return "errored"

                # This section takes a version string in the format "major.minor[.maintenance[-h|-c|-b]hotfix][.xfr]"
                # and returns a tuple of four integers representing the major, minor, maintenance, and hotfix parts
                # of the version. It handles various version formats and validates the input to ensure it follows
                # the expected format.
                try:
                    # Parse the device's current version string into its major, minor, maintenance, and hotfix.
                    current_version_sliced = parse_version(
                        version=each["db_device"].sw_version,
                    )

                    # Parse the targeted version string into its major, minor, maintenance, and hotfix.
                    target_version_sliced = parse_version(
                        version=target_version,
                    )

                    # If the device is part of an HA pair, parse the peer PAN-OS version
                    if each["db_device"].ha_enabled:
                        # Parse the targeted version string into its major, minor, maintenance, and hotfix.
                        peer_version_sliced = parse_version(
                            version=ha_details["result"]["group"]["peer-info"][
                                "build-rel"
                            ],
                        )

                        # Log the target version sliced object representing the target PAN-OS version
                        upgrade.logger.log_task(
                            action="report",
                            message=f"{each['db_device'].hostname}: Device is currently running "
                            f"{current_version_sliced} and the targeted PAN-OS upgrade version is "
                            f"{target_version_sliced}. Peer firewall is running {peer_version_sliced}.",
                        )

                    else:
                        # Log the target version sliced object representing the target PAN-OS version
                        upgrade.logger.log_task(
                            action="report",
                            message=f"{each['db_device'].hostname}: Device is currently running "
                            f"{current_version_sliced} and the targeted PAN-OS upgrade version is "
                            f"{target_version_sliced}. No peer firewall, no need to determine its version.",
                        )

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
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
                    upgrade_required = upgrade.determine_upgrade(
                        current_version=current_version_sliced,
                        device=each,
                        target_version=target_version_sliced,
                    )

                    # Gracefully exit if the firewall does not require an upgrade to target version
                    if not upgrade_required:
                        upgrade.logger.log_task(
                            action="error",
                            message=f"{each['db_device'].hostname}: It was determined that this device is not "
                            f"suitable to kick off an upgrade workflow to version {target_version}.",
                        )
                        return "errored"

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"Error determining if the device is ready to be upgraded to PAN-OS version "
                        f"{target_version}: {str(e)}",
                    )
                    return "errored"

                # This section compares the current version and target version of a firewall in an HA pair
                # to determine if the upgrade is compatible.
                try:
                    # Check if the upgrade is compatible with the HA setup
                    if each["db_device"].ha_enabled:
                        # Perform HA compatibility check for the target version
                        upgrade_compatible = upgrade.check_ha_compatibility(
                            current_version=current_version_sliced,
                            device=each,
                            target_version=target_version_sliced,
                        )

                        # Gracefully exit if the firewall does not require an upgrade to target version
                        if not upgrade_compatible:
                            # Log the message to the console
                            upgrade.logger.log_task(
                                action="error",
                                message=f"{each['db_device'].hostname}: {target_version} is not an compatible upgrade "
                                f"path for the current release used in the H"
                                f"A setup {each['db_device'].sw_version}.",
                            )

                            # Return an error status
                            return "errored"

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"Error determining if the device is ready to be upgraded to PAN-OS version "
                        f"{target_version}: {str(e)}",
                    )
                    return "errored"

                # This section issues a request on the remote device to pull down the latest version of software from
                # the customer service portal.
                try:
                    # Check if a software update is available for the device
                    available_versions = upgrade.software_available_check(
                        device=each,
                        target_version=target_version,
                    )

                    # Gracefully exit if the target version is not available
                    if not available_versions:
                        upgrade.logger.log_task(
                            action="error",
                            message=f"{each['db_device'].hostname}: Target version {target_version} is not available.",
                        )
                        return "errored"

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"Error determining if the PAN-OS version is available for download"
                        f"{target_version}: {str(e)}",
                    )
                    return "errored"

                # The section determines if the targeted PAN-OS version's base image is on the device already,
                # if not it will initiate a download of the base image.
                try:
                    # Create a base version key for the target version
                    base_version_key = (
                        f"{target_version_sliced[0]}.{target_version_sliced[1]}.0"
                    )

                    # Log the message to the console
                    upgrade.logger.log_task(
                        action="success",
                        message=f"{each['db_device'].hostname}: Checking to see if {target_version}'s base image "
                        f"{base_version_key} is available",
                    )

                    # Check if the base image is not downloaded
                    if not each["pan_device"].software.versions[base_version_key][
                        "downloaded"
                    ]:
                        # If the "downloaded" key is not set to "downloading"
                        if (
                            each["pan_device"].software.versions[base_version_key][
                                "downloaded"
                            ]
                            != "downloading"
                        ):
                            # Special log if the device is in HA mode:
                            if each["db_device"].ha_enabled:
                                # Log the message to the console
                                upgrade.logger.log_task(
                                    action="start",
                                    message=f"{each['db_device'].hostname}: Downloading base image {base_version_key} "
                                    "for target version {target_version}, will sync to HA peer.",
                                )

                            # Non-HA log message for standalone devices
                            else:
                                # Log the message to the console
                                upgrade.logger.log_task(
                                    action="start",
                                    message=f"{each['db_device'].hostname}: Downloading base image {base_version_key} "
                                    "for target version {target_version}.",
                                )

                            # Retry loop for downloading the base image
                            for attempt in range(retry_count):
                                # Log the message to the console
                                upgrade.logger.log_task(
                                    action="success",
                                    message=f"{each['db_device'].hostname}: Downloading PAN-OS version "
                                    f"{base_version_key} on the device",
                                )

                                # Download the base image for the target version
                                downloaded = PanosUpgrade.software_download(
                                    device=each["pan_device"],
                                    target_version=base_version_key,
                                )

                                # Break out of while loop if download was successful
                                if downloaded:
                                    # Log the download success message
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: Base image {base_version_key} "
                                        f"downloaded for target version {target_version}.",
                                    )

                                    # Log the waiting message
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: Waiting {wait_time} seconds to let "
                                        f"the base image {base_version_key} load into the software manager "
                                        f"before downloading {target_version}.",
                                    )

                                    # Wait for the base image to load into the software manager
                                    time.sleep(wait_time)

                                    break

                                # Retry downloading the base image if it failed
                                elif not downloaded:
                                    # Log the download failure and wait before retrying
                                    if attempt < retry_count - 1:
                                        upgrade.logger.log_task(
                                            action="error",
                                            message=f"{each['db_device'].hostname}: Failed to download base image "
                                            f"{base_version_key} for target version {target_version}. "
                                            f"Retrying after {wait_time} seconds.",
                                        )
                                        time.sleep(wait_time)

                                    # Return "errored" if the download failed after multiple attempts
                                    else:
                                        return "errored"

                        # If the status is "downloading", then we can deduce that multiple executions are being
                        # performed, so we should return an "errored" to prevent conflicts
                        else:
                            # Log the message to the console
                            upgrade.logger.log_task(
                                action="error",
                                message=f"{each['db_device'].hostname}: Base image {base_version_key} is already "
                                f"downloading, assuming that there are multiple upgrade executions taking "
                                f"place. Skipping upgrade.",
                            )

                            # Return "errored" to prevent conflicts
                            return "errored"

                    # Since the base image is already downloaded, simply log message to console
                    else:
                        # Log the message to the console
                        upgrade.logger.log_task(
                            action="success",
                            message=f"{each['db_device'].hostname}: Base image {base_version_key} was found to be "
                            f"already downloaded on the local device, so we are skipping the download process.",
                        )

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"Error downloading the base image: {str(e)} "
                        f"{target_version}: {str(e)}",
                    )

                # The section determines if the targeted PAN-OS version's image is on the device already,
                # if not it will initiate a download of the target image.
                try:
                    # Log the message to the console
                    upgrade.logger.log_task(
                        action="success",
                        message=f"{each['db_device'].hostname}: Checking to see if the target image {target_version} "
                        "is available.",
                    )

                    # Check if the target image is not downloaded or in downloading state
                    if not each["pan_device"].software.versions[target_version][
                        "downloaded"
                    ]:
                        # If the "downloaded" key is not set to "downloading"
                        if (
                            each["pan_device"].software.versions[target_version][
                                "downloaded"
                            ]
                            != "downloading"
                        ):
                            # Special log if the device is in HA mode:
                            if each["db_device"].ha_enabled:
                                # Log the message to the console
                                upgrade.logger.log_task(
                                    action="start",
                                    message=f"{each['db_device'].hostname}: Downloading target image {target_version}, "
                                    "will sync to HA peer.",
                                )

                            # Non-HA log message for standalone devices
                            else:
                                # Log the message to the console
                                upgrade.logger.log_task(
                                    action="start",
                                    message=f"{each['db_device'].hostname}: Downloading target image {target_version}.",
                                )

                            # Retry loop for downloading the target image
                            for attempt in range(retry_count):
                                # Download the target image
                                downloaded = PanosUpgrade.software_download(
                                    device=each["pan_device"],
                                    target_version=target_version,
                                )

                                # Break out of while loop if download was successful
                                if downloaded:
                                    # Log the download success message
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: Target image {target_version} is on "
                                        "the device.",
                                    )

                                    # Log the waiting message
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: Waiting {wait_time} seconds to let the "
                                        "target image load into the software manager before proceeding.",
                                    )

                                    # Wait for the base image to load into the software manager
                                    time.sleep(wait_time)

                                    break

                                # Retry downloading the target image if it failed
                                elif not downloaded:
                                    # Log the download failure and wait before retrying
                                    if attempt < retry_count - 1:
                                        upgrade.logger.log_task(
                                            action="error",
                                            message=f"{each['db_device'].hostname}: Failed to download target image "
                                            f"{target_version}. Retrying after {wait_time} seconds.",
                                        )
                                        time.sleep(wait_time)

                                    # Return "errored" if the download failed after multiple attempts
                                    else:
                                        return "errored"

                            # Log the message to the console
                            upgrade.logger.log_task(
                                action="success",
                                message=f"{each['db_device'].hostname}: Target image {target_version} is on the device",
                            )

                        # If the status is "downloading", then we can deduce that multiple executions are being
                        # performed, so we should return an "errored" to prevent conflicts
                        else:
                            # Log the message to the console
                            upgrade.logger.log_task(
                                action="error",
                                message=f"{each['db_device'].hostname}: Target image {target_version} is already "
                                f"downloading, assuming that there are multiple upgrade executions taking "
                                f"place. Skipping upgrade.",
                            )

                            # Return "errored" to prevent conflicts
                            return "errored"

                    # Since the target image is already downloaded, simply log message to console
                    else:
                        # Log the message to the console
                        upgrade.logger.log_task(
                            action="success",
                            message=f"{each['db_device'].hostname}: Target image {target_version} is already "
                            f"downloaded on the target firewall, skipping the process of downloading again.",
                        )

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"Error occurred when downloading the targeted upgrade PAN-OS version "
                        f"{target_version}: {str(e)}",
                    )

                # Handle HA scenarios for devices that are part of an HA pair, where we check to see if the HA config
                # has been successfully synced between the two firewalls. Next we compare the versions between the two
                # firewall appliances
                try:
                    if each["db_device"].ha_enabled:
                        # Create a placeholder object to determine whether the script should proceed with the
                        # upgraded, based on the state of HA and PAN-OS version delta between primary and secondary
                        # firewalls.
                        proceed_with_upgrade = False

                        # If the current device is in suspended HA state
                        if (
                            ha_details["result"]["group"]["local-info"]["state"]
                            == "suspended"
                        ):
                            # Log message to console
                            upgrade.logger.log_task(
                                action="report",
                                message=f"{each['db_device'].hostname}: Target device is in a suspended HA state",
                            )

                            # Continue with upgrade process on the initial target device
                            proceed_with_upgrade = True

                        # Wait for HA synchronization to complete
                        while (
                            ha_details["result"]["group"]["running-sync"]
                            != "synchronized"
                        ):
                            # Increment the attempt number for the PAN-OS upgrade
                            attempt = 0

                            # HA synchronization process
                            if attempt < each["profile"].max_snapshot_tries:
                                # Log the attempt number
                                upgrade.logger.log_task(
                                    action="search",
                                    message=f"{each['db_device'].hostname}: Attempt "
                                    f"{attempt + 1}/{each['profile'].max_snapshot_tries} to get HA status.",
                                )

                                # Check if the HA synchronization is complete
                                if (
                                    ha_details["result"]["group"]["running-sync"]
                                    == "synchronized"
                                ):
                                    # Log the HA synchronization status
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: HA synchronization complete.",
                                    )

                                    proceed_with_upgrade = True

                                    # break out of the loop
                                    break

                                # Check if the HA synchronization is still in progress
                                else:
                                    # Log the HA synchronization status
                                    upgrade.logger.log_task(
                                        action="working",
                                        message=f"{each['db_device'].hostname}: HA synchronization still in progress.",
                                    )

                                    # Wait for HA synchronization
                                    time.sleep(each["profile"].snapshot_retry_interval)

                                    # Increment the attempt number
                                    attempt += 1

                            # If the HA synchronization fails after multiple attempts
                            else:
                                # Log the HA synchronization status
                                upgrade.logger.log_task(
                                    action="error",
                                    message=f"{each['db_device'].hostname}: HA synchronization failed after attempting "
                                    f"for a total of {each['profile'].max_snapshot_tries} attempts.",
                                )

                                # Return an error status
                                return "errored"

                        # Compare the local and peer PAN-OS versions
                        version_comparison = upgrade.compare_versions(
                            device=each,
                            local_version_sliced=current_version_sliced,
                            peer_version_sliced=peer_version_sliced,
                        )

                        # Log the version comparison result
                        upgrade.logger.log_task(
                            action="report",
                            message=f"{each['db_device'].hostname}: Peer version comparison: {version_comparison}",
                        )

                        # If the firewall is running an older version than its peer devices
                        if (
                            version_comparison == "older"
                            or version_comparison == "equal"
                        ):
                            # Determine if we are running in Dry Run mode
                            if not dry_run:
                                # Log message to console
                                upgrade.logger.log_task(
                                    action="start",
                                    message=f"{each['db_device'].hostname}: Suspending the HA state of device",
                                )

                                # Suspend HA state of the active device
                                upgrade.suspend_ha_device(device=each)

                                # Skip the upgrade process for the target device
                                proceed_with_upgrade = True

                            else:
                                upgrade.logger.log_task(
                                    action="skipped",
                                    message=f"{each['db_device'].hostname}: Dry run mode enabled. Skipping HA state "
                                    f"suspension.",
                                )

                                # Continue with upgrade process on the active target device
                                proceed_with_upgrade = False

                        # If the firewall is running a newer version than its peer devices
                        elif version_comparison == "newer":
                            # Log message to console
                            upgrade.logger.log_task(
                                action="report",
                                message=f"{each['db_device'].hostname}: Target device is on a newer version",
                            )

                            # Passive device is running a newer version than the active peer
                            proceed_with_upgrade = False

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"Error occurred when downloading the targeted upgrade PAN-OS version "
                        f"{target_version}: {str(e)}",
                    )

                # Snapshot the firewall device before the upgrade process
                try:
                    # Perform the pre-upgrade snapshot
                    max_snapshot_tries = each["profile"].max_snapshot_tries
                    snapshot_retry_interval = each["profile"].snapshot_retry_interval

                    # Log the start of the snapshot process
                    upgrade.logger.log_task(
                        action="start",
                        message=f"{each['db_device'].hostname}: Performing snapshot of network state information.",
                    )

                    # Initialize the pre-upgrade snapshot
                    attempt = 0
                    pre_snapshot = None

                    # Attempt to take the pre-upgrade snapshot
                    while attempt < max_snapshot_tries and pre_snapshot is None:
                        # Make a snapshot attempt
                        try:
                            # Execute the snapshot operation
                            pre_snapshot = upgrade.run_assurance(
                                device=each,
                                operation_type="state_snapshot",
                            )

                            # Log the snapshot success message
                            upgrade.logger.log_task(
                                action="save",
                                message=f"{each['db_device'].hostname}: Snapshot successfully created.",
                            )

                        # Catch specific and general exceptions
                        except (AttributeError, IOError, Exception) as error:
                            # Log the snapshot error message
                            upgrade.logger.log_task(
                                action="error",
                                message=f"{each['db_device'].hostname}: Snapshot attempt failed with error: {error}. "
                                f"Retrying after {snapshot_retry_interval} seconds.",
                            )
                            upgrade.logger.log_task(
                                action="working",
                                message=f"{each['db_device'].hostname}: Waiting for {snapshot_retry_interval} seconds "
                                f"before retrying snapshot.",
                            )

                            # Wait before retrying the snapshot
                            time.sleep(snapshot_retry_interval)

                            # Increment the snapshot attempt number
                            attempt += 1

                    # If the pre-upgrade snapshot fails after multiple attempts
                    if pre_snapshot is None:
                        # Log the snapshot error message
                        upgrade.logger.log_task(
                            action="error",
                            message=f"{each['db_device'].hostname}: Failed to create snapshot after trying a total of "
                            f"{max_snapshot_tries} attempts.",
                        )

                    # Log the pre-upgrade snapshot message
                    upgrade.logger.log_task(
                        action="report",
                        message=f"{each['db_device'].hostname}: Pre-upgrade snapshot {pre_snapshot}",
                    )

                    # Remove the device from the upgrade list
                    upgrade.upgrade_devices.pop(i)

                # General exception handling
                except Exception as e:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"Error occurred when downloading the targeted upgrade PAN-OS version "
                        f"{target_version}: {str(e)}",
                    )

            # TODO: Readiness Checks
            # TODO: Upgrade
            # TODO: Post Upgrade Snapshots
            # TODO: PDF Report Generation
            # TODO: Active Firewall Upgrades

    except Exception as exc:
        upgrade.logger.log_task(
            action="error",
            message=f"Generated an exception when upgrading the list of passive/secondary devices: {exc}",
        )
        return "errored"
