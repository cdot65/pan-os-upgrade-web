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
    handles HA scenarios, performs pre-upgrade snapshots, upgrades the devices, performs post-upgrade snapshots,
    and generates PDF reports.

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
            T -->|No| V[Perform upgrade]
            V --> W[Perform post-upgrade snapshot]
            W --> X[Generate PDF report]
            X --> Y[Return "completed"]
        ```
    """

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Create a new instance of the PanosUpgrade class
    # ------------------------------------------------------------------------------------------------------------------
    upgrade_job = PanosUpgrade(
        job_id=job_id,
        profile_uuid=profile_uuid,
    )

    upgrade_job.update_current_step(
        device_name="pending",
        step_name="Initializing Upgrade Process",
    )

    # Log the start of the PAN-OS upgrade process
    upgrade_job.logger.log_task(
        action="report",
        message=f"Running PAN-OS upgrade for device: {device_uuid}, executed by author id: {author_id} "
        f"Using the profile {profile_uuid} to upgrade PAN-OS to {target_version}",
    )

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Check if the target device is the primary device in an HA pair, and if so, skip the upgrade
    # ------------------------------------------------------------------------------------------------------------------
    # Retrieve database object for target device
    targeted_device = Device.objects.get(uuid=device_uuid)
    try:
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

    except Exception as e:
        # Log the error message if the device is not found in the database
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error checking HA status of firewall devices: {str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Assign devices to either primary, secondary, or standalone; set latter two to `targeted_device`
    # ------------------------------------------------------------------------------------------------------------------
    try:
        # Perform assignment of devices
        upgrade_job.assign_upgrade_devices(
            device_uuid=device_uuid,
            profile_uuid=profile_uuid,
        )

        # Assign secondary and standalone devices to `targeted_device` to reference as first device to upgrade
        targeted_device = (
            upgrade_job.secondary_device
            if upgrade_job.secondary_device
            else upgrade_job.standalone_device
        )

    except Exception as e:
        # Log the error of determining the HA status of the target device
        upgrade_job.logger.log_task(
            action="error",
            message=f"Error assigning selected device(s) to a role as either primary, active, or standalone: {str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device and will gracefully exit the upgrade workflow if it should be within a 'suspended' state
    # ------------------------------------------------------------------------------------------------------------------
    try:
        if upgrade_job.secondary_device is not None:
            # Target the secondary devices within an HA pair and refresh the HA state using the
            # `show_highavailability_state()` method
            upgrade_job.get_ha_status(device=upgrade_job.secondary_device)

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
                    upgrade_job.update_current_step(
                        device_name=f"{targeted_device.hostname}",
                        step_name="Errored",
                    )
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
                    upgrade_job.update_current_step(
                        device_name=f"{targeted_device.hostname}",
                        step_name="Errored",
                    )
                    return "errored"

            elif upgrade_job.ha_details["result"]["local-info"]["state"] == "suspended":
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="report",
                    message=f"{upgrade_job.secondary_device['db_device'].hostname}: Target device is in a HA "
                    "suspended state, skipping upgrade_job.",
                )

                # Raise an exception to skip the upgrade process
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device['db_device'].hostname}",
                    step_name="Errored",
                )
                return "errored"

            elif upgrade_job.ha_details["result"]["peer-info"]["state"] == "suspended":
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="report",
                    message=f"{upgrade_job.secondary_device['db_device'].hostname}: Peer device is in a HA "
                    "suspended state, skipping upgrade_job.",
                )

                # Raise an exception to skip the upgrade process
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device['db_device'].hostname}",
                    step_name="Errored",
                )
                return "errored"

    except Exception as e:
        # Log the error of determining the HA status of the target device
        upgrade_job.logger.log_task(
            action="error",
            message=f"{upgrade_job.secondary_device['pan_device']}: Error determining the HA status of the target "
            f"device: {str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device returns a tuple of four integers representing the major, minor, maintenance, and hotfix
    # parts of the version.
    # ------------------------------------------------------------------------------------------------------------------
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

    except Exception as e:
        # Log the error of parsing PAN-OS versions
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error parsing the current and/or targeted upgrade "
            f"version of PAN-OS: {str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device compares current and target version to determine if an upgrade is necessary.
    # ------------------------------------------------------------------------------------------------------------------
    try:
        # Check if the specified version is older than the current version
        upgrade_job.determine_upgrade(
            current_version=upgrade_job.version_local_parsed,
            hostname=targeted_device["db_device"].hostname,
            target_version=upgrade_job.version_target_parsed,
        )

        # Gracefully exit if the firewall does not require an upgrade to target version
        if not upgrade_job.upgrade_required:
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: It was determined that this device is not "
                f"suitable to kick off an upgrade workflow to version {target_version}.",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    except Exception as e:
        # Log the error of checking if upgrade to targeted version is required
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error determining if the device is ready to be upgraded "
            f"to PAN-OS version {target_version}: {str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device compares current and target version of devices in an HA pair, determine if the
    # upgrade is compatible
    # ------------------------------------------------------------------------------------------------------------------
    try:
        # Check if the upgrade is compatible with the HA setup
        if targeted_device["db_device"].ha_enabled:
            # Perform HA compatibility check for the target version
            upgrade_job.check_ha_compatibility(
                current_version=upgrade_job.version_local_parsed,
                hostname=targeted_device["db_device"].hostname,
                target_version=upgrade_job.version_target_parsed,
            )

            # Gracefully exit if the firewall does not require an upgrade to target version
            if upgrade_job.stop_upgrade_workflow:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{targeted_device['db_device'].hostname}: {target_version} is not an compatible upgrade "
                    f"path for the current release used in the H"
                    f"A setup {targeted_device['db_device'].sw_version}.",
                )

                # Return an error status
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device['db_device'].hostname}",
                    step_name="Errored",
                )
                return "errored"

    except Exception as e:
        # Log the error of checking if targeted version compatible with HA upgrade
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error determining if the devices in an HA pair are "
            f"compatible for the target PAN-OS version {target_version}: {str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device issues a request to pull down the latest version of software from CSP
    # ------------------------------------------------------------------------------------------------------------------
    try:
        # Check if a software update is available for the device
        version_available = upgrade_job.software_available_check(
            device=targeted_device,
            target_version=target_version,
        )

        # Gracefully exit if the target version is not available
        if not version_available:
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: Target version {target_version} is not available.",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    except Exception as e:
        # Log the error of checking if targeted version is available in CSP
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error determining if the PAN-OS version is available for"
            f" download {target_version}: {str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device determination if the targeted version's base image is on the device already, else download
    # ------------------------------------------------------------------------------------------------------------------
    try:
        # Create a base version key for the target version
        base_version_key = f"{upgrade_job.version_target_parsed[0]}.{upgrade_job.version_target_parsed[1]}.0"

        # Log the message to the console
        upgrade_job.logger.log_task(
            action="search",
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
                for attempt in range(
                    upgrade_job.profile["download"]["maximum_attempts"]
                ):
                    # Log the message to the console
                    upgrade_job.logger.log_task(
                        action="start",
                        message=f"{targeted_device['db_device'].hostname}: Downloading PAN-OS version "
                        f"{base_version_key} on the device",
                    )

                    # Download the base image for the target version
                    downloaded = upgrade_job.software_download(
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
                            action="working",
                            message=f"{targeted_device['db_device'].hostname}: Waiting "
                            f"{upgrade_job.profile['download']['retry_interval']} seconds to let the base image "
                            f"{base_version_key} load into the software manager before downloading {target_version}.",
                        )

                        # Wait for the base image to load into the software manager
                        time.sleep(upgrade_job.profile["download"]["retry_interval"])

                        break

                    # Retry downloading the base image if it failed
                    elif not downloaded:
                        # Log the download failure and wait before retrying
                        if (
                            attempt
                            < upgrade_job.profile["download"]["maximum_attempts"] - 1
                        ):
                            upgrade_job.logger.log_task(
                                action="error",
                                message=f"{targeted_device['db_device'].hostname}: Failed to download base image "
                                f"{base_version_key} for target version {target_version}. "
                                f"Retrying after {upgrade_job.profile['download']['retry_interval']} seconds.",
                            )
                            time.sleep(
                                upgrade_job.profile["download"]["retry_interval"]
                            )

                        # Return "errored" if the download failed after multiple attempts
                        else:
                            upgrade_job.update_current_step(
                                device_name=f"{targeted_device['db_device'].hostname}",
                                step_name="Errored",
                            )
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
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device['db_device'].hostname}",
                    step_name="Errored",
                )
                return "errored"

        # Since the base image is already downloaded, simply log message to console
        else:
            # Log the message to the console
            upgrade_job.logger.log_task(
                action="report",
                message=f"{targeted_device['db_device'].hostname}: Base image {base_version_key} was found to be "
                f"already downloaded on the local device, so we are skipping the download process.",
            )

    except Exception as e:
        # Log the error of checking if or downloading the targeted version's base image on the device already
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error downloading the base image: {str(e)} ",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device determination if the targeted version's image is on the device already, else download
    # ------------------------------------------------------------------------------------------------------------------
    try:
        # Log the message to the console
        upgrade_job.logger.log_task(
            action="search",
            message=f"{targeted_device['db_device'].hostname}: Checking to see if the target image {target_version} "
            "is available.",
        )

        # Target device determination if the targeted version's image is on the device already, else download
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
                for attempt in range(
                    upgrade_job.profile["download"]["maximum_attempts"]
                ):
                    # Download the target image
                    downloaded = upgrade_job.software_download(
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
                            message=f"{targeted_device['db_device'].hostname}: Waiting "
                            f"{upgrade_job.profile['download']['retry_interval']} seconds to let the target image load "
                            f"into the software manager before proceeding.",
                        )

                        # Wait for the base image to load into the software manager
                        time.sleep(upgrade_job.profile["download"]["retry_interval"])

                        break

                    # Retry downloading the target image if it failed
                    elif not downloaded:
                        # Log the download failure and wait before retrying
                        if (
                            attempt
                            < upgrade_job.profile["download"]["maximum_attempts"] - 1
                        ):
                            upgrade_job.logger.log_task(
                                action="error",
                                message=f"{targeted_device['db_device'].hostname}: Failed to download target image "
                                f"{target_version}. Retrying after {upgrade_job.profile['download']['retry_interval']} "
                                f"seconds.",
                            )
                            time.sleep(
                                upgrade_job.profile["download"]["retry_interval"]
                            )

                        # Return "errored" if the download failed after multiple attempts
                        else:
                            upgrade_job.update_current_step(
                                device_name=f"{targeted_device['db_device'].hostname}",
                                step_name="Errored",
                            )
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
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

        # Since the target image is already downloaded, simply log message to console
        else:
            # Log the message to the console
            upgrade_job.logger.log_task(
                action="success",
                message=f"{targeted_device['db_device'].hostname}: Target image {target_version} is already "
                f"downloaded on the target firewall, skipping the process of downloading again.",
            )

    except Exception as e:
        # Log the error of checking if or downloading the targeted version's image on the device already
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error occurred when downloading the targeted upgrade "
            f"PAN-OS version {target_version}: {str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: HA pair checks to see if the config has been successfully synced between the two firewalls
    # ------------------------------------------------------------------------------------------------------------------
    try:
        if targeted_device["db_device"].ha_enabled:
            # If the secondary device is in suspended HA state
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
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

            # Wait for HA synchronization to complete
            while (
                upgrade_job.ha_details["result"]["group"]["running-sync"]
                != "synchronized"
            ):
                # Increment the attempt number for the PAN-OS upgrade
                attempt = 0

                # HA synchronization process
                if attempt < upgrade_job.profile["snapshots"]["maximum_attempts"]:
                    # Log the attempt number
                    upgrade_job.logger.log_task(
                        action="search",
                        message=f"{targeted_device['db_device'].hostname}: Attempt "
                        f"{attempt + 1}/{upgrade_job.profile['snapshots']['maximum_attempts']} to get HA status.",
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
                        time.sleep(upgrade_job.profile["snapshots"]["retry_interval"])

                        # Increment the attempt number
                        attempt += 1

                # If the HA synchronization fails after multiple attempts
                else:
                    # Log the HA synchronization status
                    upgrade_job.logger.log_task(
                        action="error",
                        message=f"{targeted_device['db_device'].hostname}: HA synchronization failed after attempting "
                        f"for a total of {upgrade_job.profile['snapshots']['maximum_attempts']} attempts.",
                    )

                    # Return an error status
                    upgrade_job.update_current_step(
                        device_name=f"{targeted_device.hostname}",
                        step_name="Errored",
                    )
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

            # If the targeted_device is running a newer version than its peer devices
            if version_comparison == "newer":
                # Log message to console
                upgrade_job.logger.log_task(
                    action="report",
                    message=f"{targeted_device['db_device'].hostname}: Target device is on a newer version",
                )

                # Return "errored", gracefully exiting the upgrade's execution
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

    except Exception as e:
        # Log the error of the HA pair configuration sync check failing before upgrade
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error occurred when validating the HA status of device: "
            f"{str(e)}",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # --------------------------------------------------------------------------------------------------------------
    # Workflow: Target device readiness checks
    # --------------------------------------------------------------------------------------------------------------
    try:
        upgrade_job.perform_readiness_checks(
            device=targeted_device,
        )
        if not upgrade_job.readiness_checks_succeeded:
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    except Exception as e:
        # Log the error of the target device's readiness checks failing before upgrade
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error occurred when performing the "
            f"readiness checks of the device: {str(e)} ",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device snapshot before the upgrade process
    # ------------------------------------------------------------------------------------------------------------------
    try:
        # Snapshot the target device before the upgrade process
        upgrade_job.take_snapshot(
            device=targeted_device,
            snapshot_type="pre",
        )

        # Safely exit the script should the snapshot of the target device fail before the upgrade process
        if not upgrade_job.snapshot_succeeded:
            # Log the message to the console
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: Snapshot failed to complete successfully before the "
                f"upgrade initiated.",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    except Exception as e:
        # Log the error of the target device's snapshot failing before upgrade
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error occurred when performing the "
            f"snapshot of the network state of device: {str(e)} ",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device HA suspension
    # ------------------------------------------------------------------------------------------------------------------
    if not upgrade_job.standalone_device:
        try:
            if not dry_run:
                # Log message to console
                upgrade_job.logger.log_task(
                    action="start",
                    message=f"{targeted_device['db_device'].hostname}: Suspending the HA state of device",
                )

                # Suspend HA state of the active device
                upgrade_job.suspend_ha_device(
                    device=targeted_device,
                )

            else:
                upgrade_job.logger.log_task(
                    action="skipped",
                    message=f"{targeted_device['db_device'].hostname}: Dry run mode enabled. Skipping HA state "
                    f"suspension.",
                )

        except Exception as e:
            # Log the error of the target device's upgrade
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: Error occurred when performing the "
                f"HA suspension of the device: {str(e)} ",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device upgrade process
    # ------------------------------------------------------------------------------------------------------------------
    try:
        if not dry_run:
            # Log the error of the target device's upgrade
            upgrade_job.logger.log_task(
                action="start",
                message=f"{targeted_device['db_device'].hostname}: Dry run disabled, beginning the upgrade workflow.",
            )
            # Perform upgrade of the target device
            upgrade_status = upgrade_job.perform_upgrade(
                device=targeted_device,
                target_version=target_version,
            )

            # Gracefully exit if the target device fails its upgrade to target version
            if upgrade_job.stop_upgrade_workflow:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{targeted_device['db_device'].hostname}: Upgrade to {target_version} failed, "
                    f"status: {upgrade_status}.",
                )

                # Return an error status
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

    except Exception as e:
        # Log the error of the target device's upgrade
        upgrade_job.logger.log_task(
            action="error",
            message=f"{targeted_device['db_device'].hostname}: Error occurred when performing the "
            f"upgrade of the device: {str(e)} ",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device reboot process
    # ------------------------------------------------------------------------------------------------------------------
    if not dry_run:
        try:
            # Perform reboot of the upgraded target device
            upgrade_job.perform_reboot(
                device=targeted_device,
                target_version=target_version,
            )

            # Gracefully exit if the target device fails its reboot
            if upgrade_job.stop_upgrade_workflow:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{targeted_device['db_device'].hostname}: Request to reboot the device failed.",
                )

                # Return an error status
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

        except Exception as e:
            # Log the error of the target device's reboot
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: Error occurred when performing the "
                f"reboot of the device: {str(e)} ",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device snapshot after the upgrade process
    # ------------------------------------------------------------------------------------------------------------------
    if not dry_run:
        try:
            # Wait for the device to become ready for the post upgrade snapshot
            upgrade_job.logger.log_task(
                action="start",
                message=f"{targeted_device['db_device'].hostname}: Waiting for the device to become ready for the post "
                "upgrade snapshot.",
            )
            time.sleep(120)

            # Snapshot the target device after the upgrade process
            upgrade_job.take_snapshot(
                device=targeted_device,
                snapshot_type="post",
            )

            # Safely exit the script should the snapshot of the target device fail after the upgrade process
            if not upgrade_job.snapshot_succeeded:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{targeted_device['db_device'].hostname}: Snapshot failed to complete "
                    f"successfully after the upgrade completed.",
                )
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

        except Exception as e:
            # Log the error of the snapshot on target device after the upgrade
            upgrade_job.logger.log_task(
                action="error",
                message=f"{targeted_device['db_device'].hostname}: Error occurred when performing the snapshot "
                f"of the network state of device: {str(e)} ",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device PDF report generation on pre/post upgrade diff
    # ------------------------------------------------------------------------------------------------------------------
    # TODO: PDF Report Generation

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Exit the upgrade workflow if there is no primary_device attribute
    # ------------------------------------------------------------------------------------------------------------------
    if not upgrade_job.primary_device:
        upgrade_job.update_current_step(
            device_name=f"{targeted_device['db_device'].hostname}",
            step_name="Upgrade Completed!",
        )
        return "completed"

    # --------------------------------------------------------------------------------------------------------------
    # Workflow: Primary device readiness checks
    # --------------------------------------------------------------------------------------------------------------
    # Perform readiness checks on the primary device before the upgrade process
    upgrade_job.update_current_step(
        device_name=f"{upgrade_job.primary_device.hostname}",
        step_name="Beginning upgrade workflow on active device",
    )

    try:
        upgrade_job.perform_readiness_checks(
            device=upgrade_job.primary_device,
        )

        # Attempt to perform readiness checks
        if not upgrade_job.readiness_checks_succeeded:
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    except Exception as e:
        # Log the error of the primary device's readiness checks failing before upgrade
        upgrade_job.logger.log_task(
            action="error",
            message=f"{upgrade_job.primary_device['db_device'].hostname}: Error occurred when performing the "
            f"readiness checks of the device: {str(e)} ",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Primary device snapshot before the upgrade process
    # ------------------------------------------------------------------------------------------------------------------
    # Snapshot the primary firewall device before the upgrade process
    try:
        upgrade_job.take_snapshot(
            device=upgrade_job.primary_device,
            snapshot_type="pre",
        )

        # Safely exit the script should the snapshot of the primary device fail before the upgrade process
        if not upgrade_job.snapshot_succeeded:
            # Log the message to the console
            upgrade_job.logger.log_task(
                action="error",
                message=f"{upgrade_job.primary_device['db_device'].hostname}: Snapshot failed to complete "
                f"successfully before the upgrade initiated.",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    except Exception as e:
        # Log the error of the primary device's snapshot failing before upgrade
        upgrade_job.logger.log_task(
            action="error",
            message=f"{upgrade_job.primary_device['db_device'].hostname}: Error occurred when performing the "
            f"snapshot of the network state of device: {str(e)} ",
        )
        upgrade_job.update_current_step(
            device_name=f"{targeted_device.hostname}",
            step_name="Errored",
        )
        return "errored"

    # --------------------------------------------------------------------------------------------------------------
    # Workflow: Primary device upgrade
    # --------------------------------------------------------------------------------------------------------------
    if not dry_run:
        try:
            # Perform upgrade of the primary device
            upgrade_status = upgrade_job.perform_upgrade(
                device=upgrade_job.primary_device,
                target_version=target_version,
            )

            # Gracefully exit if the primary device fails its upgrade to target version
            if upgrade_job.stop_upgrade_workflow:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{upgrade_job.primary_device['db_device'].hostname}: Upgrade to {target_version} failed, "
                    f"status: {upgrade_status}.",
                )

                # Return an error status
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

        except Exception as e:
            # Log the error of the target device's upgrade
            upgrade_job.logger.log_task(
                action="error",
                message=f"{upgrade_job.primary_device['db_device'].hostname}: Error occurred when performing the "
                f"upgrade of the device: {str(e)} ",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Primary device reboot process
    # ------------------------------------------------------------------------------------------------------------------
    if not dry_run:
        try:
            # Perform reboot of the upgraded primary device
            upgrade_job.perform_reboot(
                device=upgrade_job.primary_device,
                target_version=target_version,
            )

            # Gracefully exit if the primary device fails its reboot
            if upgrade_job.stop_upgrade_workflow:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{upgrade_job.primary_device['db_device'].hostname}: Request to reboot the device failed.",
                )

                # Return an error status
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

        except Exception as e:
            # Log the error of the target device's reboot
            upgrade_job.logger.log_task(
                action="error",
                message=f"{upgrade_job.primary_device['db_device'].hostname}: Error occurred when performing the "
                f"reboot of the device: {str(e)} ",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Primary device snapshot after the upgrade process
    # ------------------------------------------------------------------------------------------------------------------
    if not dry_run:
        try:
            # Wait for the device to become ready for the post upgrade snapshot
            upgrade_job.logger.log_task(
                action="start",
                message=f"{upgrade_job.primary_device['db_device'].hostname}: Waiting for the device to become ready "
                f"for the post upgrade snapshot.",
            )
            time.sleep(120)

            # Log the start of the snapshot process on target device after the upgrade
            upgrade_job.logger.log_task(
                action="start",
                message=f"{upgrade_job.primary_device['db_device'].hostname}: Performing snapshot of network state "
                "information after the upgrade.",
            )

            # Snapshot the primary device after the upgrade process
            upgrade_job.take_snapshot(
                device=upgrade_job.primary_device,
                snapshot_type="post",
            )

            # Safely exit the script should the snapshot of the target device fail before the upgrade process
            if not upgrade_job.snapshot_succeeded:
                # Log the message to the console
                upgrade_job.logger.log_task(
                    action="error",
                    message=f"{upgrade_job.primary_device['db_device'].hostname}: Snapshot failed to complete "
                    f"successfully after the upgrade was completed.",
                )
                upgrade_job.update_current_step(
                    device_name=f"{targeted_device.hostname}",
                    step_name="Errored",
                )
                return "errored"

        except Exception as e:
            # Log the error of the snapshot on target device after the upgrade
            upgrade_job.logger.log_task(
                action="error",
                message=f"{upgrade_job.primary_device['db_device'].hostname}: Error occurred when performing the "
                f"snapshot of the network state of device: {str(e)} ",
            )
            upgrade_job.update_current_step(
                device_name=f"{targeted_device.hostname}",
                step_name="Errored",
            )
            return "errored"

    # ------------------------------------------------------------------------------------------------------------------
    # Workflow: Target device PDF report generation on pre/post upgrade diff
    # ------------------------------------------------------------------------------------------------------------------
    # TODO: PDF Report Generation
