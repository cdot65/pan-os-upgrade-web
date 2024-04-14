# backend/panosupgradeweb/scripts/panos_upgrade/app.py
import os
import sys
import argparse
import json
import logging

import django

# Add the Django project's root directory to the Python path
sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
)

# Set the DJANGO_SETTINGS_MODULE environment variable
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_project.settings")

# Initialize the Django application
django.setup()

# import our Django models
from panosupgradeweb.models import Device, Profile  # noqa: E402


def run_panos_upgrade(
    device_uuid,
    author_id,
    profile_uuid,
    target_version,
):
    logging.debug(f"Running PAN-OS upgrade for device: {device_uuid}")
    logging.debug(f"Author ID: {author_id}")
    logging.debug(f"Using profile: {profile_uuid}")
    logging.debug(f"Target PAN-OS version: {target_version}")

    try:
        # Retrieve the Device and Profile objects from the database
        device = Device.objects.get(uuid=device_uuid)
        profile = Profile.objects.get(uuid=profile_uuid)

        # Access the authentication data directly from the profile fields
        pan_username = profile.pan_username
        pan_password = profile.pan_password

        # TODO: Implement the PAN-OS upgrade workflow using the pan-os-upgrade dependency

        # Return the JSON output indicating the execution status
        json_output = json.dumps(
            {
                "exec": "upgrade workflow executed",
                "device": f"{device.hostname}",
                "pan_username": f"{pan_username}",
                "pan_password": f"{pan_password}",
            }
        )
        return json_output

    except Exception as e:
        logging.error(f"Error during PAN-OS upgrade: {str(e)}")
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

    device_uuid = args.device_uuid
    author_id = args.author_id
    profile_uuid = args.profile_uuid
    target_version = args.target_version

    run_panos_upgrade(
        device_uuid,
        author_id,
        profile_uuid,
        target_version,
    )
