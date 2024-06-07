# backend/panosupgradeweb/scripts/panos_upgrade/app.py
import time

from celery.exceptions import WorkerLostError
from panosupgradeweb.models import Device
from .logger import UpgradeLogger
from .upgrade import PanosUpgrade
from .utilities import parse_version

# Create an instance of the custom logger
job_logger = UpgradeLogger("pan-os-upgrade-upgrade")


def main(
        author_id: int,
        device_uuid: str,
        dry_run: bool,
        job_id: str,
        profile_uuid: str,
        target_version: str,
) -> str:
    # Create a new instance of the PanosUpgrade class
    upgrade = PanosUpgrade(job_id)

    # Log the start of the PAN-OS upgrade process
    upgrade.logger.log_task(
        action="report",
        message=f"Running PAN-OS upgrade for device: {device_uuid}",
    )
    upgrade.logger.log_task(
        action="report",
        message=f"Author ID: {author_id}",
    )
    upgrade.logger.log_task(
        action="report",
        message=f"Using profile: {profile_uuid}",
    )
    upgrade.logger.log_task(
        action="report",
        message=f"Target PAN-OS version: {target_version}",
    )

    # Check if the device is the primary device in an HA pair, and if so, skip the upgrade
    try:
        device = Device.objects.get(uuid=device_uuid)

        # Check if the device is the primary device in an HA pair, and if so, skip the upgrade
        if device.ha_enabled and device.local_state in ["active", "active-primary"]:
            # Log the HA status of the firewall device
            upgrade.logger.log_task(
                action="report",
                message=f"{device.hostname}: Device is the primary device in an HA pair.",
            )

            # Log that the upgrade can only be initiated by the workflow to upgrade the HA peer firewall
            upgrade.logger.log_task(
                action="report",
                message=f"{device.hostname}: The upgrade of this device can only be initiated by the workflow to upgrade the HA peer firewall.",
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

    # Prepare the upgrade_devices list of targeted firewall, and HA peer if applicable
    try:
        upgrade.create_list_of_upgrade_devices(device_uuid, profile_uuid)

    except Exception as e:
        upgrade.logger.log_task(
            action="error",
            message=f"Error preparing upgrade devices: {str(e)}",
        )

    # Perform the upgrade process for devices that are passive, active-secondary, or standalone
    for i, each in enumerate(upgrade.upgrade_devices):

        # Parse the current version into major, minor, maintenance, and hotfix parts
        current_version_sliced = parse_version(
            version=each["db_device"].sw_version,
        )

        # Log the current version sliced object representing the target firewall PAN-OS version
        upgrade.logger.log_task(
            action="report",
            message=f"{each['db_device'].hostname}: Current version sliced: {current_version_sliced}",
        )

        # Parse the target version into major, minor, maintenance, and hotfix parts
        target_version_sliced = parse_version(
            version=target_version,
        )

        # Log the target version sliced object representing the target PAN-OS version
        upgrade.logger.log_task(
            action="report",
            message=f"{each['db_device'].hostname}: Target version sliced: {target_version_sliced}",
        )

        # Initialize with default values
        max_retries = 3
        retry_interval = 60

        # Re-fetch the HA status to get the latest state
        ha_details = upgrade.get_ha_status(device=each)

        # Skip the upgrade process for devices that are suspended
        if each["db_device"].local_state in ["suspended"]:
            # Log the message to the console
            upgrade.logger.log_task(
                action="report",
                message=f"{each['db_device'].hostname}: Device is suspended. Skipping upgrade.",
            )

            # Remove the device from the upgrade list
            upgrade.upgrade_devices.pop(i)

            # Raise an exception to skip the upgrade process
            return "errored"

        # Target the passive, active-secondary, or standalone devices for the upgrade process
        if (
                each["db_device"].local_state in ["passive", "active-secondary"]
                or not each["db_device"].ha_enabled
        ):

            # If the device is part of an HA pair, parse the peer PAN-OS version
            if each["db_device"].ha_enabled:
                # Parse the peer PAN-OS version into major, minor, maintenance, and hotfix parts
                peer_version_sliced = parse_version(
                    version=ha_details["result"]["group"]["peer-info"]["build-rel"],
                )

            # Check to see if the firewall is ready to upgrade to target version
            try:

                # Log the start of the PAN-OS upgrade process
                upgrade.logger.log_task(
                    action="report",
                    message=f"{each['db_device'].hostname}: Checking to see if a PAN-OS upgrade is available.",
                )

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
                        message=f"{each['db_device'].hostname}: Not ready for upgrade to {target_version}.",
                    )
                    return "errored"

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
                            message=f"{each['db_device'].hostname}: {target_version} is not an compatible upgrade path for the current release used in the HA setup {each['db_device'].sw_version}.",
                        )

                        # Return an error status
                        return "errored"

            # General exception handling for celery task
            except WorkerLostError as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                )
                return "errored"

            # General exception handling for upgrade evaluation process
            except Exception as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                )
                return "errored"

            # Check if the software update is available and, if so, download the base/target versions
            try:
                # Check if a software update is available for the firewall
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

                # Check if the base image for the target version is already downloaded
                if available_versions:

                    # Set the number of retries and wait time for downloading the base image
                    retry_count = each["profile"].max_download_tries
                    wait_time = each["profile"].download_retry_interval

                    # Create a base version key for the target version
                    base_version_key = (
                        f"{target_version_sliced[0]}.{target_version_sliced[1]}.0"
                    )

                    # Log the message to the console
                    upgrade.logger.log_task(
                        action="success",
                        message=f"{each['db_device'].hostname}: Checking if base image {base_version_key} is available.",
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
                                    message=f"{each['db_device'].hostname}: Downloading base image {base_version_key} for target version {target_version}, will sync to HA peer.",
                                )

                            # Non-HA log message for standalone devices
                            else:

                                # Log the message to the console
                                upgrade.logger.log_task(
                                    action="start",
                                    message=f"{each['db_device'].hostname}: Downloading base image {base_version_key} for target version {target_version}.",
                                )

                            # Retry loop for downloading the base image
                            for attempt in range(retry_count):

                                # Download the base image for the target version
                                downloaded = PanosUpgrade.software_download(
                                    target_version=base_version_key,
                                )

                                # Break out of while loop if download was successful
                                if downloaded:

                                    # Log the download success message
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: Base image {base_version_key} downloaded for target version {target_version}.",
                                    )

                                    # Log the waiting message
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: Waiting {wait_time} seconds to let the base image {base_version_key} load into the software manager before downloading {target_version}.",
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
                                            message=f"{each['db_device'].hostname}: Failed to download base image {base_version_key} for target version {target_version}. Retrying after {wait_time} seconds.",
                                        )
                                        time.sleep(wait_time)

                                    # Return "errored" if the download failed after multiple attempts
                                    else:
                                        return "errored"

                            # Log the message to the console
                            upgrade.logger.log_task(
                                action="success",
                                message=f"{each['db_device'].hostname}: Base image {base_version_key} is on the device.",
                            )

                        # If the status is "downloading", then we can deduce that multiple executions are being performed so we should return an "errored" to prevent conflicts
                        else:

                            # Log the message to the console
                            upgrade.logger.log_task(
                                action="error",
                                message=f"{each['db_device'].hostname}: Base image {base_version_key} is already downloading, assuming that there are multiple upgrade executions taking place. Skipping upgrade.",
                            )

                            # Return "errored" to prevent conflicts
                            return "errored"

                    # Since the base image is already downloaded, simply log message to console
                    else:

                        # Log the message to the console
                        upgrade.logger.log_task(
                            action="success",
                            message=f"{each['db_device'].hostname}: Base image {base_version_key} is already downloaded.",
                        )

                    # Log the message to the console
                    upgrade.logger.log_task(
                        action="success",
                        message=f"{each['db_device'].hostname}: Checking if target image {target_version} is available.",
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
                                    message=f"{each['db_device'].hostname}: Downloading target image {target_version}, will sync to HA peer.",
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
                                    target_version=target_version,
                                )

                                # Break out of while loop if download was successful
                                if downloaded:

                                    # Log the download success message
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: Target image {target_version} on the device.",
                                    )

                                    # Log the waiting message
                                    upgrade.logger.log_task(
                                        action="success",
                                        message=f"{each['db_device'].hostname}: Waiting {wait_time} seconds to let the target image load into the software manager before proceeding.",
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
                                            message=f"{each['db_device'].hostname}: Failed to download target image {target_version}. Retrying after {wait_time} seconds.",
                                        )
                                        time.sleep(wait_time)

                                    # Return "errored" if the download failed after multiple attempts
                                    else:
                                        return "errored"

                            # Log the message to the console
                            upgrade.logger.log_task(
                                action="success",
                                message=f"{each['db_device'].hostname}: Target image {target_version} is on the device.",
                            )

                        # If the status is "downloading", then we can deduce that multiple executions are being performed so we should return an "errored" to prevent conflicts
                        else:

                            # Log the message to the console
                            upgrade.logger.log_task(
                                action="error",
                                message=f"{each['db_device'].hostname}: Target image {target_version} is already downloading, assuming that there are multiple upgrade executions taking place. Skipping upgrade.",
                            )

                            # Return "errored" to prevent conflicts
                            return "errored"

                    # Since the target image is already downloaded, simply log message to console
                    else:

                        # Log the message to the console
                        upgrade.logger.log_task(
                            action="success",
                            message=f"{each['db_device'].hostname}: Target image {target_version} is already downloaded.",
                        )

            # General exception handling for celery task
            except WorkerLostError as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                )
                return "errored"

            # General exception handling for the software download process
            except Exception as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                )
                return "errored"

            # Handle HA scenarios for devices that are part of an HA pair
            if each["db_device"].ha_enabled:
                try:

                    # Wait for HA synchronization to complete
                    while (
                            ha_details["result"]["group"]["running-sync"] != "synchronized"
                    ):

                        # Increment the attempt number for the PAN-OS upgrade
                        attempt = 0

                        # HA synchronization process
                        if attempt < max_retries:

                            # Log the attempt number
                            upgrade.logger.log_task(
                                action="search",
                                message=f"{each['db_device'].hostname}: Attempt {attempt + 1}/{max_retries} to get HA status.",
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
                                time.sleep(retry_interval)

                                # Increment the attempt number
                                attempt += 1

                        # If the HA synchronization fails after multiple attempts
                        else:

                            # Log the HA synchronization status
                            upgrade.logger.log_task(
                                action="error",
                                message=f"{each['db_device'].hostname}: HA synchronization failed after {max_retries} attempts.",
                            )

                            # Return an error status
                            return "errored"

                    # Compare the local and peer PAN-OS versions
                    version_comparison = upgrade.compare_versions(
                        device=each,
                        local_version_sliced=current_version_sliced,
                        peer_version_sliced=peer_version_sliced,
                    )

                    # ipdb.set_trace()

                    # Log the version comparison result
                    upgrade.logger.log_task(
                        action="report",
                        message=f"{each['db_device'].hostname}: Peer version comparison: {version_comparison}",
                    )

                    # If the firewall and its peer devices are running the same version
                    if version_comparison == "equal":

                        # If the current device is active or active-primary
                        if (
                                ha_details["result"]["group"]["local-info"]["state"]
                                == "active"
                                or ha_details["result"]["group"]["local-info"]["state"]
                                == "active-primary"
                        ):

                            # Log message to console
                            upgrade.logger.log_task(
                                action="search",
                                message=f"{each['db_device'].hostname}: Target device is active and peer is running the same version, skipping HA state suspension.",
                            )

                            # Skip the upgrade process for the active target device
                            proceed_with_upgrade = False

                        # If the current device is passive or active-secondary
                        elif (
                                ha_details["result"]["group"]["local-info"]["state"]
                                == "passive"
                                or ha_details["result"]["group"]["local-info"]["state"]
                                == "active-secondary"
                        ):

                            # Suspend HA state of the target device
                            if not dry_run:

                                # Log message to console
                                upgrade.logger.log_task(
                                    action="start",
                                    message=f"{each['db_device'].hostname}: Suspending HA state of passive or active-secondary",
                                )

                                # Suspend HA state of the passive device
                                upgrade.suspend_ha_device(device=each)

                                # Continue with upgrade process on the passive target device
                                proceed_with_upgrade = True

                            # If we are running in Dry Run mode
                            else:

                                # Log message to console
                                upgrade.logger.log_task(
                                    action="skipped",
                                    message=f"{each['db_device'].hostname}: Target device is passive, but we are in dry-run mode. Skipping HA state suspension.",
                                )

                                # Continue with upgrade process on the passive target device
                                proceed_with_upgrade = False

                        # If the current device is in initial HA state
                        elif (
                                ha_details["result"]["group"]["local-info"]["state"]
                                == "initial"
                        ):

                            # Log message to console
                            upgrade.logger.log_task(
                                action="report",
                                message=f"{each['db_device'].hostname}: Target device is in initial HA state",
                            )

                            # Continue with upgrade process on the initial target device
                            proceed_with_upgrade = False

                        # If the current device is in suspended HA state
                        elif (
                                ha_details["result"]["group"]["local-info"]["state"]
                                == "suspended"
                        ):

                            # Log message to console
                            upgrade.logger.log_task(
                                action="report",
                                message=f"{each['db_device'].hostname}: Target device is in a suspended HA state",
                            )

                            # Continue with upgrade process on the initial target device
                            proceed_with_upgrade = False

                    # If the firewall is running an older version than its peer devices
                    elif version_comparison == "older":

                        # Log message to console
                        upgrade.logger.log_task(
                            action="report",
                            message=f"{each['db_device'].hostname}: Target device is on an older version",
                        )

                        # Determine if we are running in Dry Run mode
                        if dry_run:

                            # Log message to console
                            upgrade.logger.log_task(
                                action="skipped",
                                message=f"{each['db_device'].hostname}: Dry run mode enabled. Skipping HA state suspension.",
                            )

                            # Skip the upgrade process for the target device
                            proceed_with_upgrade = False

                        # Non-Dry Run mode will perform our HA state suspension
                        elif (
                                ha_details["result"]["group"]["local-info"]["state"]
                                == "active"
                                or ha_details["result"]["group"]["local-info"]["state"]
                                == "active-primary"
                        ):

                            # Suspend HA state of active or active-primary
                            upgrade.logger.log_task(
                                action="start",
                                message=f"{each['db_device'].hostname}: Suspending HA state of active or active-primary",
                            )

                            # Suspend HA state of the active device
                            upgrade.suspend_ha_device(device=each)

                            # Continue with upgrade process on the active target device
                            proceed_with_upgrade = True

                    # If the firewall is running a newer version than its peer devices
                    elif version_comparison == "newer":

                        # Log message to console
                        upgrade.logger.log_task(
                            action="report",
                            message=f"{each['db_device'].hostname}: Target device is on a newer version",
                        )

                        # Continue with upgrade process on the passive target device
                        proceed_with_upgrade = True

                # General exception handling for celery task
                except WorkerLostError as exc:

                    # Log the error message
                    upgrade.logger.log_task(
                        action="error",
                        message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                    )

                    # Return an error status
                    return "errored"

                # General exception handling for HA scenarios
                except Exception as exc:

                    # Log the error message
                    upgrade.logger.log_task(
                        action="error",
                        message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                    )

                    # Return an error status
                    return "errored"

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
                            message=f"{each['db_device'].hostname}: Snapshot attempt failed with error: {error}. Retrying after {snapshot_retry_interval} seconds.",
                        )
                        upgrade.logger.log_task(
                            action="working",
                            message=f"{each['db_device'].hostname}: Waiting for {snapshot_retry_interval} seconds before retrying snapshot.",
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
                        message=f"{each['db_device'].hostname}: Failed to create snapshot after {max_snapshot_tries} attempts.",
                    )

                # Log the pre-upgrade snapshot message
                upgrade.logger.log_task(
                    action="report",
                    message=f"{each['db_device'].hostname}: Pre-upgrade snapshot {pre_snapshot}",
                )

                # Remove the device from the upgrade list
                upgrade.upgrade_devices.pop(i)

            # General exception handling for celery task
            except WorkerLostError as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                )
                return "errored"

            # General exception handling for pre-upgrade snapshot process
            except Exception as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                )
                return "errored"

        # TODO: Readiness Checks

    # Perform the upgrade process for devices that are active or active-primary
    for i, each in enumerate(upgrade.upgrade_devices):
        if each["db_device"].local_state in ["active", "active-primary"]:

            # Check to see if the firewall is ready to upgrade to target version
            try:
                upgrade.logger.log_task(
                    action="report",
                    message=f"{each['db_device'].hostname}: Checking to see if a PAN-OS upgrade is available.",
                )

                update_available = upgrade.software_available_check(
                    device=each,
                    target_version=target_version,
                )

                # Gracefully exit if the firewall is not ready for an upgrade to target version
                if not update_available:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"{each['db_device'].hostname}: Not ready for upgrade to {target_version}.",
                    )
                    return "errored"

            # General exception handling for celery task
            except WorkerLostError as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                )
                return "errored"

            # General exception handling for upgrade evaluation process
            except Exception as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                )
                return "errored"

            # Determine if the firewall is part of an HA pair and handle HA scenarios
            try:
                if each["db_device"].ha_enabled:
                    proceed_with_upgrade = upgrade.handle_firewall_ha(
                        device=each,
                        dry_run=dry_run,
                    )

                    # Gracefully exit the execution if the firewall is not ready for an upgrade to target version
                    if not proceed_with_upgrade:
                        upgrade.logger.log_task(
                            action="error",
                            message=f"{each['db_device'].hostname}: Switching control to the peer firewall for upgrade.",
                        )
                        return "errored"

            # General exception handling for celery task
            except WorkerLostError as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                )
                return "errored"

            # General exception handling for HA scenarios
            except Exception as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                )
                return "errored"

            # Make sure the target version is downloaded to the firewall(s)
            try:
                upgrade.logger.log_task(
                    action="start",
                    message=f"{each['db_device'].hostname}: Performing test to see if {target_version} is already downloaded.",
                )

                image_downloaded = PanosUpgrade.software_download(
                    target_version=target_version,
                )

                if each["db_device"].ha_enabled and image_downloaded:
                    upgrade.logger.log_task(
                        action="success",
                        message=f"{each['db_device'].hostname}: {target_version} has been downloaded and sync'd to HA peer.",
                    )
                elif image_downloaded:
                    upgrade.logger.log_task(
                        action="success",
                        message=f"{each['db_device'].hostname}: version {target_version} has been downloaded.",
                    )
                else:
                    upgrade.logger.log_task(
                        action="error",
                        message=f"{each['db_device'].hostname}: Image not downloaded, exiting.",
                    )
                    return "errored"

            # General exception handling for celery task
            except WorkerLostError as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                )
                return "errored"

            # General exception handling for software download process
            except Exception as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                )
                return "errored"

            # Perform the pre-upgrade snapshot
            try:
                pre_snapshot = upgrade.perform_snapshot(device=each)

                upgrade.logger.log_task(
                    action="report",
                    message=f"{each['db_device'].hostname}: Pre-upgrade snapshot {pre_snapshot}",
                )

                upgrade.upgrade_devices.pop(i)

            # General exception handling for celery task
            except WorkerLostError as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Worker lost: {exc}",
                )
                return "errored"

            # General exception handling for pre-upgrade snapshot process
            except Exception as exc:
                upgrade.logger.log_task(
                    action="error",
                    message=f"{each['db_device'].hostname}: Generated an exception: {exc}",
                )
                return "errored"

        # Skip the upgrade process for devices that are suspended
        elif each["db_device"].local_state in ["suspended"]:
            upgrade.logger.log_task(
                action="report",
                message=f"{each['db_device'].hostname}: Device is suspended. Skipping upgrade.",
            )
            upgrade.upgrade_devices.pop(i)
            raise

    return "completed"
