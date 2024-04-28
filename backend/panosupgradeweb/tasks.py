# backend/panosupgradeweb/tasks.py

import sys
import os
import django
import logging
import traceback

from celery import shared_task
from django.contrib.auth import get_user_model
from panosupgradeweb.models import Job
import json

# import your inventory sync script
from panosupgradeweb.scripts import (
    run_inventory_sync,
    run_device_refresh,
    run_panos_upgrade,
)

# ----------------------------------------------------------------------------
# Configure logging
# ----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s [%(levelname)s] %(message)s"
)

sys.path.append("/code/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_project.settings")
django.setup()
User = get_user_model()


# ----------------------------------------------------------------------------
# Inventory Sync Task
# ----------------------------------------------------------------------------
@shared_task(bind=True)
def execute_inventory_sync(
    self,
    panorama_device_uuid,
    profile_uuid,
    author_id,
):
    logging.debug("Inventory sync task started!")
    # Retrieve the user object by id
    author = User.objects.get(id=author_id)
    logging.debug(f"Author: {author}")

    # Create a new Job entry
    job = Job.objects.create(
        job_type="inventory_sync",
        json_data=None,
        author=author,
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    try:
        json_output = run_inventory_sync(
            author_id=author_id,
            job_id=job.task_id,
            panorama_device_uuid=panorama_device_uuid,
            profile_uuid=profile_uuid,
        )
        job.json_data = json_output
    except Exception as e:
        job.json_data = f"Job ID: {job.pk}\nError: {e}"
        logging.error(f"Exception Type: {type(e).__name__}")
        logging.error(f"Traceback: {traceback.format_exc()}")

    # Save the updated job information
    job.save()


# ----------------------------------------------------------------------------
# Device Refresh Task
# ----------------------------------------------------------------------------
@shared_task(bind=True)
def execute_refresh_device_task(
    self,
    device_uuid,
    profile_uuid,
    author_id,
):
    logging.debug("Device refresh task started!")
    author = User.objects.get(id=author_id)
    logging.debug(f"Author: {author}")

    job = Job.objects.create(
        job_type="device_refresh",
        json_data=None,
        author=author,
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    try:
        json_output = run_device_refresh(
            author_id=author_id,
            device_uuid=device_uuid,
            job_id=job.task_id,
            profile_uuid=profile_uuid,
        )
        job.json_data = json_output
    except Exception as e:
        job.json_data = f"Job ID: {job.pk}\nError: {e}"
        logging.error(f"Exception Type: {type(e).__name__}")
        logging.error(f"Traceback: {traceback.format_exc()}")

    job.save()


# ----------------------------------------------------------------------------
# Device Upgrade Task
# ----------------------------------------------------------------------------
@shared_task(bind=True)
def execute_upgrade_device_task(
    self,
    author_id: int,
    device_uuid: str,
    dry_run: bool,
    profile_uuid: str,
    target_version: str,
):
    logging.debug(f"Device upgrade task started for device: {device_uuid}")
    author = User.objects.get(id=author_id)
    logging.debug(f"Author: {author}")

    job = Job.objects.create(
        job_type="device_upgrade",
        json_data=None,
        author=author,
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    try:
        # Update the job status to indicate the task has started
        json_data = {
            "status": "Starting PAN-OS upgrade task, change refresh rate below to view logs live..."
        }
        job.json_data = json.dumps(json_data)

        # Run the PAN-OS upgrade script
        json_output = run_panos_upgrade(
            author_id=author_id,
            device_uuid=device_uuid,
            dry_run=dry_run,
            job_id=job.task_id,
            profile_uuid=profile_uuid,
            target_version=target_version,
        )

        # Update the job status with the output from the script
        job.json_data = json_output
    except Exception as e:
        job.json_data = f"Job ID: {job.pk}\nError: {e}"
        logging.error(f"Exception Type: {type(e).__name__}")
        logging.error(f"Traceback: {traceback.format_exc()}")

    job.save()
