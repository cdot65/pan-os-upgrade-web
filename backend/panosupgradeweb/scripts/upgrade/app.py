# backend/panosupgradeweb/scripts/panos_upgrade/app.py
import argparse
import json
import logging
import os
import re
import sys
import time

from typing import Dict, List, Optional, Tuple, Union

import django

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
from pan_os_upgrade.components.utilities import flatten_xml_to_dict, get_emoji

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


def check_ha_compatibility(
    device: Dict,
    current_major: int,
    current_minor: int,
    target_major: int,
    target_minor: int,
) -> bool:

    # Check if the major upgrade is more than one release apart
    if target_major - current_major > 1:
        log_upgrade(
            device["job_id"],
            "WARNING",
            f"{get_emoji(action='warning')} {device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that is more than one major release apart may cause compatibility issues.",
        )
        return False

    # Check if the upgrade is within the same major version but the minor upgrade is more than one release apart
    elif target_major == current_major and target_minor - current_minor > 1:
        log_upgrade(
            device["job_id"],
            "WARNING",
            f"{get_emoji(action='warning')} {device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that is more than one minor release apart may cause compatibility issues.",
        )
        return False

    # Check if the upgrade spans exactly one major version but also increases the minor version
    elif target_major - current_major == 1 and target_minor > 0:
        log_upgrade(
            device["job_id"],
            "WARNING",
            f"{get_emoji(action='warning')} {device['db_device'].hostname}: Upgrading firewalls in an HA pair to a version that spans more than one major release or increases the minor version beyond the first in the next major release may cause compatibility issues.",
        )
        return False

    # Log compatibility check success
    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='success')} {device['db_device'].hostname}: The target version is compatible with the current version.",
    )
    return True


def compare_versions(
    version1: str,
    version2: str,
) -> str:

    parsed_version1 = parse_version(version=version1)
    parsed_version2 = parse_version(version=version2)

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
    current_version_parsed = parse_version(version=device["db_device"].sw_version)

    if isinstance(target_maintenance, int):
        # Handling integer maintenance version separately
        target_version = (target_major, target_minor, target_maintenance, 0)
    else:
        # Handling string maintenance version with hotfix
        target_version = parse_version(
            version=f"{target_major}.{target_minor}.{target_maintenance}"
        )

    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='report')} {device['db_device'].hostname}: Current version: {device['db_device'].sw_version}.",
    )
    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='report')} {device['db_device'].hostname}: Target version: {target_major}.{target_minor}.{target_maintenance}.",
    )

    if current_version_parsed < target_version:
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='success')} {device['db_device'].hostname}: Upgrade required from {device['db_device'].sw_version} to {target_major}.{target_minor}.{target_maintenance}",
        )
    else:
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='skipped')} {device['db_device'].hostname}: No upgrade required or downgrade attempt detected.",
        )
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='skipped')} {device['db_device'].hostname}: Halting upgrade.",
        )
        sys.exit(0)


def get_ha_status(device: Dict) -> Tuple[str, Optional[dict]]:

    log_upgrade(
        device["job_id"],
        "DEBUG",
        f"{get_emoji(action='start')} {device['db_device'].hostname}: Getting {device['pan_device'].serial} deployment information.",
    )
    deployment_type = device["pan_device"].show_highavailability_state()

    log_upgrade(
        device["job_id"],
        "DEBUG",
        f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device deployment: {deployment_type[0]}",
    )

    if deployment_type[1]:
        ha_details = flatten_xml_to_dict(element=deployment_type[1])

        log_upgrade(
            device["job_id"],
            "DEBUG",
            f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device deployment details: {ha_details}",
        )
        return deployment_type[0], ha_details
    else:
        return deployment_type[0], None


def handle_firewall_ha(
    device: Dict,
    dry_run: bool,
) -> Tuple[bool, Optional[Firewall]]:

    # If the target device is not part of an HA configuration, proceed with the upgrade
    if not device["db_device"].ha_enabled:
        return True, None

    local_state = device["db_device"].local_state
    local_version = device["db_device"].sw_version

    # Retrieve the HA details from the target device
    peer_device = Device.objects.get(uuid=device["db_device"].peer_device_id)
    peer_version = peer_device.sw_version

    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='report')} {device['db_device'].hostname}: Local state: {local_state}, Local version: {local_version}, Peer Device: {peer_device.hostname}, Peer version: {peer_version}",
    )

    # Initialize with default values
    max_retries = 3
    retry_interval = 60

    for attempt in range(max_retries):
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='report')} {device['db_device'].hostname}: Attempt {attempt + 1}/{max_retries} to get HA status.",
        )
        # Wait for HA synchronization
        time.sleep(retry_interval)

        # Re-fetch the HA status to get the latest state
        _, ha_details = get_ha_status(device=device)
        local_version = ha_details["result"]["group"]["local-info"]["build-rel"]
        peer_version = ha_details["result"]["group"]["peer-info"]["build-rel"]

        if ha_details["result"]["group"]["running-sync"] == "synchronized":
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='success')} {device['db_device'].hostname}: HA synchronization complete.",
            )
            break
        else:
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='report')} {device['db_device'].hostname}: HA synchronization still in progress. Rechecking after wait period.",
            )

    version_comparison = compare_versions(
        version1=local_version,
        version2=peer_version,
    )
    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='report')} {device['db_device'].hostname}: Version comparison: {version_comparison}",
    )

    # If the firewall and its peer devices are running the same version
    if version_comparison == "equal":

        # if the current device is active or active-primary
        if local_state == "active" or local_state == "active-primary":

            # log message to console
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='search')} {device['db_device'].hostname}: Detected active target device in HA pair running the same version as its peer.",
            )

            # Exit the upgrade process for the target device at this time, to be revisited later
            return False, None

        # if the current device is passive or active-secondary
        elif local_state == "passive" or local_state == "active-secondary":

            # suspend HA state of the target device
            if not dry_run:
                log_upgrade(
                    device["job_id"],
                    "INFO",
                    f"{get_emoji(action='report')} {device['db_device'].hostname}: Suspending HA state of passive or active-secondary",
                )
                suspend_ha_passive(device=device)

            # log message to console
            else:
                log_upgrade(
                    device["job_id"],
                    "INFO",
                    f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device is passive, but we are in dry-run mode. Skipping HA state suspension.",
                )

            # Continue with upgrade process on the passive target device
            return True, None

        elif local_state == "initial":
            # Continue with upgrade process on the initial target device
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device is in initial HA state",
            )
            return True, None

    elif version_comparison == "older":
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device is on an older version",
        )
        # Suspend HA state of active if the passive is on a later release
        if local_state == "active" or local_state == "active-primary" and not dry_run:
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='report')} {device['db_device'].hostname}: Suspending HA state of active or active-primary",
            )
            suspend_ha_active(device=device)
        return True, None

    elif version_comparison == "newer":
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='report')} {device['db_device'].hostname}: Target device is on a newer version",
        )
        # Suspend HA state of passive if the active is on a later release
        if (
            local_state == "passive"
            or local_state == "active-secondary"  # noqa: W503
            and not dry_run  # noqa: W503
        ):
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='report')} {device['db_device'].hostname}: Suspending HA state of passive or active-secondary",
            )
            suspend_ha_passive(device=device)
        return True, None

    return False, None


def log_upgrade(
    job_id,
    level,
    message,
):
    job = Job.objects.get(task_id=job_id)
    UpgradeLog.objects.create(
        job=job,
        level=level,
        message=message,
    )


def log_snapshot(
    job_id,
    snapshot_type,
    snapshot_data,
):
    job = Job.objects.get(task_id=job_id)
    SnapshotLog.objects.create(
        job=job,
        snapshot_type=snapshot_type,
        snapshot_data=snapshot_data,
    )


def log_readiness_check(
    job_id,
    check_name,
    check_result,
    check_details,
):
    job = Job.objects.get(task_id=job_id)
    ReadinessCheckLog.objects.create(
        job=job,
        check_name=check_name,
        check_result=check_result,
        check_details=check_details,
    )


def parse_version(version: str) -> Tuple[int, int, int, int]:

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

    max_snapshot_tries = device["profile"].max_snapshot_tries
    snapshot_retry_interval = device["profile"].snapshot_retry_interval

    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='start')} {device['db_device'].hostname}: Performing snapshot of network state information.",
    )
    attempt = 0
    snapshot = None

    while attempt < max_snapshot_tries and snapshot is None:
        try:
            # Log snapshot attempt
            log_snapshot(
                device["job_id"],
                "snapshot_attempt",
                {"attempt": attempt + 1, "max_attempts": max_snapshot_tries},
            )

            # Take snapshots
            snapshot = run_assurance(
                device=device,
                operation_type="state_snapshot",
            )

            log_snapshot(
                device["job_id"],
                "snapshot_result",
                snapshot,
            )

            # if snapshot is not None and isinstance(snapshot, SnapshotReport):
            #     logging.info(
            #         f"{get_emoji(action='success')} {hostname}: Network snapshot created successfully on attempt {attempt + 1}."
            #     )

            #     # Save the snapshot to the specified file path as JSON
            #     ensure_directory_exists(file_path=file_path)
            #     with open(file_path, "w") as file:
            #         file.write(snapshot.model_dump_json(indent=4))

            #     logging.info(
            #         f"{get_emoji(action='save')} {hostname}: Network state snapshot collected and saved to {file_path}"
            #     )

            #     return snapshot

        # Catch specific and general exceptions
        except (AttributeError, IOError, Exception) as error:
            log_upgrade(
                device["job_id"],
                "ERROR",
                f"{get_emoji(action='error')} {device['db_device'].hostname}: Snapshot attempt failed with error: {error}. Retrying after {snapshot_retry_interval} seconds.",
            )
            time.sleep(snapshot_retry_interval)
            attempt += 1

    if snapshot is None:
        log_upgrade(
            device["job_id"],
            "ERROR",
            f"{get_emoji(action='error')} {device['db_device'].hostname}: Failed to create snapshot after {max_snapshot_tries} attempts.",
        )


def run_assurance(
    device: Device,
    operation_type: str,
) -> any:

    # setup Firewall client
    proxy_firewall = FirewallProxy(device["pan_device"])
    checks_firewall = CheckFirewall(proxy_firewall)
    log_upgrade(
        device["job_id"],
        "DEBUG",
        f"{get_emoji(action='report')} {device['db_device'].hostname}: Running assurance on firewall {checks_firewall}",
    )

    results = None

    # if operation_type == "readiness_check":
    #     for action in actions:
    #         if action not in AssuranceOptions.READINESS_CHECKS.keys():
    #             logging.error(
    #                 f"{get_emoji(action='error')} {hostname}: Invalid action for readiness check: {action}"
    #             )

    #             sys.exit(1)

    #     try:
    #         logging.info(
    #             f"{get_emoji(action='start')} {hostname}: Performing readiness checks to determine if firewall is ready for upgrade."
    #         )
    #         result = checks_firewall.run_readiness_checks(actions)

    #         for (
    #             test_name,
    #             test_info,
    #         ) in AssuranceOptions.READINESS_CHECKS.items():
    #             check_readiness_and_log(
    #                 hostname=hostname,
    #                 result=result,
    #                 test_info=test_info,
    #                 test_name=test_name,
    #             )

    #         return ReadinessCheckReport(**result)

    #     except Exception as e:
    #         logging.error(
    #             f"{get_emoji(action='error')} {hostname}: Error running readiness checks: {e}"
    #         )

    #         return None

    # elif operation_type == "state_snapshot":
    #     # validate each type of action
    #     for action in actions:
    #         if action not in AssuranceOptions.STATE_SNAPSHOTS.keys():
    #             logging.error(
    #                 f"{get_emoji(action='error')} {hostname}: Invalid action for state snapshot: {action}"
    #             )
    #             return

    #     # take snapshots
    #     try:
    #         logging.debug(
    #             f"{get_emoji(action='start')} {hostname}: Performing snapshots."
    #         )
    #         results = checks_firewall.run_snapshots(snapshots_config=actions)
    #         logging.debug(
    #             f"{get_emoji(action='report')} {hostname}: Snapshot results {results}"
    #         )

    #         if results:
    #             # Pass the results to the SnapshotReport model
    #             return SnapshotReport(hostname=hostname, **results)
    #         else:
    #             return None

    #     except Exception as e:
    #         logging.error(
    #             f"{get_emoji(action='error')} {hostname}: Error running snapshots: %s",
    #             e,
    #         )
    #         return

    # elif operation_type == "report":
    #     for action in actions:
    #         if action not in AssuranceOptions.REPORTS.keys():
    #             logging.error(
    #                 f"{get_emoji(action='error')} {hostname}: Invalid action for report: {action}"
    #             )
    #             return
    #         logging.info(
    #             f"{get_emoji(action='report')} {hostname}: Generating report: {action}"
    #         )
    #         # result = getattr(Report(firewall), action)(**config)

    # else:
    #     logging.error(
    #         f"{get_emoji(action='error')} {hostname}: Invalid operation type: {operation_type}"
    #     )
    #     return

    return results


def software_download(
    device: Dict,
    target_version: str,
) -> bool:

    if device["pan_device"].software.versions[target_version]["downloaded"]:
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='success')} {device['db_device'].hostname}: version {target_version} already on target device.",
        )
        return True

    if (
        not device["pan_device"].software.versions[target_version]["downloaded"]
        or device["pan_device"].software.versions[target_version][  # noqa: W503
            "downloaded"
        ]
        != "downloading"  # noqa: W503
    ):
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='search')} {device['db_device'].hostname}: version {target_version} is not on the target device",
        )

        start_time = time.time()

        try:
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='start')} {device['db_device'].hostname}: version {target_version} is beginning download",
            )
            device["pan_device"].software.download(target_version)
        except PanDeviceXapiError as download_error:
            log_upgrade(
                device["job_id"],
                "ERROR",
                f"{get_emoji(action='error')} {device['db_device'].hostname}: Download Error {download_error}",
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
                    device["job_id"],
                    "INFO",
                    f"{get_emoji(action='success')} {device['db_device'].hostname}: {target_version} downloaded in {elapsed_time} seconds",
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
                        device["job_id"],
                        "INFO",
                        f"{get_emoji(action='working')} {device['db_device'].hostname}: {status_msg} - Elapsed time: {elapsed_time} seconds",
                    )
                else:
                    log_upgrade(
                        device["job_id"],
                        "INFO",
                        f"{get_emoji(action='working')} {device['db_device'].hostname}: {status_msg} - Elapsed time: {elapsed_time} seconds",
                    )
            else:
                log_upgrade(
                    device["job_id"],
                    "ERROR",
                    f"{get_emoji(action='error')} {device['db_device'].hostname}: Download failed after {elapsed_time} seconds",
                )
                return False

            time.sleep(30)

    else:
        log_upgrade(
            device["job_id"],
            "ERROR",
            f"{get_emoji(action='error')} {device['db_device'].hostname}: Error downloading {target_version}.",
        )

        sys.exit(1)


def software_update_check(
    device: Dict,
    target_version: str,
) -> bool:

    # parse target_version
    target_major, target_minor, target_maintenance = target_version.split(".")

    # Convert target_major and target_minor to integers
    target_major = int(target_major)
    target_minor = int(target_minor)

    # Check if target_maintenance can be converted to an integer
    if target_maintenance.isdigit():
        # Convert target_maintenance to integer
        target_maintenance = int(target_maintenance)

    # check to see if the specified version is older than the current version
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

    # retrieve available versions of PAN-OS
    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='working')} {device['db_device'].hostname}: Refreshing list of available software versions",
    )
    device["pan_device"].software.check()
    available_versions = device["pan_device"].software.versions

    if target_version in available_versions:
        retry_count = device["profile"].max_download_tries
        wait_time = device["profile"].download_retry_interval

        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='report')} {device['db_device'].hostname}: Version {target_version} is available for download",
        )

        base_version_key = f"{target_major}.{target_minor}.0"
        if available_versions.get(base_version_key, {}).get("downloaded"):
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='success')} {device['db_device'].hostname}: Base image for {target_version} is already downloaded",
            )
            return True
        else:
            for attempt in range(retry_count):
                log_upgrade(
                    device["job_id"],
                    "INFO",
                    f"{get_emoji(action='report')} {device['db_device'].hostname}: Base image for {target_version} is not downloaded. Attempting download.",
                )
                downloaded = software_download(
                    device=device,
                    target_version=target_version,
                )

                if downloaded:
                    log_upgrade(
                        device["job_id"],
                        "INFO",
                        f"{get_emoji(action='success')} {device['db_device'].hostname}: Base image {base_version_key} downloaded successfully",
                    )
                    log_upgrade(
                        device["job_id"],
                        "INFO",
                        f"{get_emoji(action='success')} {device['db_device'].hostname}: Pausing for {wait_time} seconds to let {base_version_key} image load into the software manager before downloading {target_version}",
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
                            device["job_id"],
                            "INFO",
                            f"{get_emoji(action='report')} {device['db_device'].hostname}: Waiting for device to load the new base image into software manager",
                        )
                        # Retry if the version is still not recognized
                        continue
                else:
                    if attempt < retry_count - 1:
                        log_upgrade(
                            device["job_id"],
                            "INFO",
                            f"{get_emoji(action='report')} {device['db_device'].hostname}: Failed to download base image for version {target_version}. Retrying in {wait_time} seconds.",
                        )
                        time.sleep(wait_time)
                    else:
                        log_upgrade(
                            device["job_id"],
                            "ERROR",
                            f"{get_emoji(action='error')} {device['db_device'].hostname}: Failed to download base image after {retry_count} attempts.",
                        )
                        return False

    else:
        return False


def suspend_ha_active(device: Dict) -> bool:

    try:
        suspension_response = device["pan_device"].op(
            "<request><high-availability><state><suspend/></state></high-availability></request>",
            cmd_xml=False,
        )

        response_message = flatten_xml_to_dict(suspension_response)

        if response_message["result"] == "Successfully changed HA state to suspended":
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='success')} {device['db_device'].hostname}: Active target device HA state suspended.",
            )
            return True
        else:
            log_upgrade(
                device["job_id"],
                "ERROR",
                f"{get_emoji(action='error')} {device['db_device'].hostname}: Failed to suspend active target device HA state.",
            )
            return False
    except Exception as e:
        log_upgrade(
            device["job_id"],
            "ERROR",
            f"{get_emoji(action='error')} {device['db_device'].hostname}: Error suspending active target device HA state: {e}",
        )
        return False


def suspend_ha_passive(device: Dict) -> bool:

    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='start')} {device['db_device'].hostname}: Suspending passive target device HA state.",
    )

    try:
        suspension_response = device["pan_device"].op(
            "<request><high-availability><state><suspend/></state></high-availability></request>",
            cmd_xml=False,
        )

        response_message = flatten_xml_to_dict(suspension_response)

        if response_message["result"] == "Successfully changed HA state to suspended":
            log_upgrade(
                device["job_id"],
                "INFO",
                f"{get_emoji(action='success')} {device['db_device'].hostname}: Passive target device HA state suspended.",
            )
            return True
        else:
            log_upgrade(
                device["job_id"],
                "ERROR",
                f"{get_emoji(action='error')} {device['db_device'].hostname}: Failed to suspend passive target device HA state.",
            )
            return False
    except Exception as e:
        log_upgrade(
            device["job_id"],
            "ERROR",
            f"{get_emoji(action='error')} {device['db_device'].hostname}: Error suspending passive target device HA state: {e}",
        )
        return False


def upgrade_firewall(
    device: Dict,
    dry_run: bool,
    target_version: str,
) -> None:

    # Check to see if the firewall is ready for an upgrade
    log_upgrade(
        device["job_id"],
        "DEBUG",
        f"{get_emoji(action='report')} {device['db_device'].hostname}: Checking to see if a PAN-OS upgrade is available.",
    )

    update_available = software_update_check(
        device=device,
        target_version=target_version,
    )

    # gracefully exit if the firewall is not ready for an upgrade to target version
    if not update_available:
        log_upgrade(
            device["job_id"],
            "ERROR",
            f"{get_emoji(action='report')} {device['db_device'].hostname}: Not ready for upgrade to {target_version}.",
        )
        sys.exit(1)

    # If firewall is part of HA pair, determine if it's active or passive
    if device["db_device"].ha_enabled:
        proceed_with_upgrade, peer_firewall = handle_firewall_ha(
            device=device,
            dry_run=dry_run,
        )

        # gracefully exit the upgrade_firewall function if the firewall is not ready for an upgrade to target version
        if not proceed_with_upgrade:
            if peer_firewall:
                log_upgrade(
                    device["job_id"],
                    "INFO",
                    f"{get_emoji(action='start')} {device['db_device'].hostname}: Switching control to the peer firewall for upgrade.",
                )
                upgrade_firewall(
                    peer_firewall,
                    target_version,
                    dry_run,
                )
            else:
                return  # Exit the function without proceeding to upgrade

    # Download the target version
    log_upgrade(
        device["job_id"],
        "INFO",
        f"{get_emoji(action='start')} {device['db_device'].hostname}: Performing test to see if {target_version} is already downloaded.",
    )
    image_downloaded = software_download(
        device=device,
        target_version=target_version,
    )

    if device["db_device"].ha_enabled and image_downloaded:
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='success')} {device['db_device'].hostname}: {target_version} has been downloaded and sync'd to HA peer.",
        )
    elif image_downloaded:
        log_upgrade(
            device["job_id"],
            "INFO",
            f"{get_emoji(action='success')} {device['db_device'].hostname}: version {target_version} has been downloaded.",
        )
    else:
        log_upgrade(
            device["job_id"],
            "ERROR",
            f"{get_emoji(action='error')} {device['db_device'].hostname}: Image not downloaded, exiting.",
        )
        sys.exit(1)

    # Begin snapshots of the network state

    # Determine snapshot actions to perform based on Profile fields
    # selected_actions = [
    #     action
    #     for action, attrs in AssuranceOptions.STATE_SNAPSHOTS.items()
    #     if getattr(profile, action.lower() + "_snapshot", False)
    # ]

    # Perform the pre-upgrade snapshot
    pre_snapshot = perform_snapshot(
        device=device,
        file_path=f'assurance/snapshots/{device["db_device"].hostname}/pre/{time.strftime("%Y-%m-%d_%H-%M-%S")}.json',
    )

    log_upgrade(
        device["job_id"],
        "DEBUG",
        f"{get_emoji(action='report')} {device['db_device'].hostname}: Pre-upgrade snapshot {pre_snapshot}",
    )

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
):
    # Check to see if the firewall is ready for an upgrade
    log_upgrade(
        job_id,
        "DEBUG",
        f"{get_emoji(action='report')} Running PAN-OS upgrade for device: {device_uuid}",
    )
    log_upgrade(
        job_id,
        "DEBUG",
        f"{get_emoji(action='report')} Author ID: {author_id}",
    )
    log_upgrade(
        job_id,
        "DEBUG",
        f"{get_emoji(action='report')} Using profile: {profile_uuid}",
    )
    log_upgrade(
        job_id,
        "DEBUG",
        f"{get_emoji(action='report')} Target PAN-OS version: {target_version}",
    )

    upgrade_devices = []

    try:
        # Retrieve the Device and Profile objects from the database
        device = Device.objects.get(uuid=device_uuid)
        profile = Profile.objects.get(uuid=profile_uuid)

        # Perform common setup tasks, return a connected device
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

        # Create a dictionary object to store the device, firewall, and profile objects
        device = {
            "db_device": device,
            "job_id": job_id,
            "pan_device": firewall,
            "profile": profile,
        }
        log_upgrade(
            device["job_id"],
            "DEBUG",
            f"{get_emoji(action='report')} {device['db_device'].hostname}: Device and firewall objects created.",
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

                # If the device is managed by Panorama, we should use the serial instead of the IP address
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
                    device["job_id"],
                    "INFO",
                    f"{get_emoji(action='info')} {upgrade_devices[0]['db_device'].hostname}: HA peer firewall added to the upgrade list.",
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
                        device["job_id"],
                        "ERROR",
                        f"{get_emoji(action='error')} {each['db_device'].hostname}: Generated an exception: {exc}",
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
                        device["job_id"],
                        "ERROR",
                        f"{get_emoji(action='error')} {each['db_device'].hostname}: Generated an exception: {exc}",
                    )

        # Return the JSON output indicating the execution status
        json_output = json.dumps(
            {
                "exec": "upgrade workflow executed",
                "device": f"{device.hostname}",
            }
        )
        return json_output

    except Exception as e:
        log_upgrade(
            device["job_id"],
            "ERROR",
            f"{get_emoji(action='error')} Error during PAN-OS upgrade: {str(e)}",
        )
        raise e


if __name__ == "__main__":
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

    run_panos_upgrade(
        author_id,
        device_uuid,
        dry_run=dry_run,
        profile_uuid=profile_uuid,
        target_version=target_version,
    )
