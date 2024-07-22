# backend/panosupgradeweb/tasks.py

import sys
import os
import django
import logging
import traceback

from celery import shared_task
from django.contrib.auth import get_user_model
from panosupgradeweb.models import Device, Job

# import the inventory sync script
from panosupgradeweb.scripts import (
    run_inventory_sync,
    run_device_refresh,
    run_panos_version_sync,
    run_upgrade_device,
)

from celery.exceptions import WorkerTerminate

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
        author=author,
        job_status="pending",
        job_type="inventory_sync",
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    try:
        job.job_status = "running"
        job.save()

        job_status = run_inventory_sync(
            author_id=author_id,
            job_id=job.task_id,
            panorama_device_uuid=panorama_device_uuid,
            profile_uuid=profile_uuid,
        )

        if job_status == "errored":
            job.job_status = "errored"
            raise WorkerTerminate()
        elif job_status == "skipped":
            job.job_status = "skipped"
        else:
            job.job_status = "completed"

    except Exception as e:
        job.job_status = "errored"
        logging.error(f"{job.pk}\nError: {e}")
        logging.error(f"Exception Type: {type(e).__name__}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise WorkerTerminate()

    finally:
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
        author=author,
        job_status="pending",
        job_type="device_refresh",
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    try:
        job.job_status = "running"
        job.save()

        job_status = run_device_refresh(
            author_id=author_id,
            device_uuid=device_uuid,
            job_id=job.task_id,
            profile_uuid=profile_uuid,
        )

        if job_status == "errored":
            job.job_status = "errored"
            raise WorkerTerminate()
        elif job_status == "skipped":
            job.job_status = "skipped"
        else:
            job.job_status = "completed"

    except Exception as e:
        job.job_status = "errored"
        logging.debug(f"Job ID: {job.pk}\nError: {e}")
        logging.error(f"Exception Type: {type(e).__name__}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise WorkerTerminate()

    finally:
        job.save()


# ----------------------------------------------------------------------------
# PAN-OS Version Sync Task
# ----------------------------------------------------------------------------
@shared_task(bind=True)
def execute_panos_version_sync(
    self,
    device_uuid,
    profile_uuid,
    author_id,
):
    logging.debug("PAN-OS version sync task started!")
    author = User.objects.get(id=author_id)
    logging.debug(f"Author: {author}")

    job = Job.objects.create(
        author=author,
        job_status="pending",
        job_type="panos_version_sync",
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    try:
        job.job_status = "running"
        job.save()

        job_status = run_panos_version_sync(
            author_id=author_id,
            device_uuid=device_uuid,
            job_id=job.task_id,
            profile_uuid=profile_uuid,
        )

        if job_status == "errored":
            job.job_status = "errored"
            raise WorkerTerminate()
        elif job_status == "skipped":
            job.job_status = "skipped"
        else:
            job.job_status = "completed"

    except Exception as e:
        job.job_status = "errored"
        logging.error(f"{job.pk}\nError: {e}")
        logging.error(f"Exception Type: {type(e).__name__}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise WorkerTerminate()

    finally:
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

    # Fetch the device
    device = Device.objects.get(uuid=device_uuid)
    peer_device = device.peer_device

    job_data = {
        "author": author,
        "job_status": "pending",
        "job_type": "upgrade",
        "task_id": self.request.id,
        "current_device": device.hostname,  # Set the initial current_device
        "target_device_group": device.device_group,
        "target_ha_enabled": device.ha_enabled,
        "target_hostname": device.hostname,
        "target_local_state": device.local_state,
        "target_panorama_managed": device.panorama_managed,
        "target_peer_device": peer_device.hostname if peer_device else None,
        "target_peer_state": device.peer_state,
        "target_platform": device.platform.name if device.platform else None,
        "target_serial": device.serial,
        "target_sw_version": device.sw_version,
    }

    if peer_device:
        job_data.update(
            {
                "peer_device_group": peer_device.device_group,
                "peer_ha_enabled": peer_device.ha_enabled,
                "peer_hostname": peer_device.hostname,
                "peer_local_state": peer_device.local_state,
                "peer_panorama_managed": peer_device.panorama_managed,
                "peer_peer_device": device.hostname,
                "peer_peer_state": peer_device.peer_state,
                "peer_platform": peer_device.platform.name
                if peer_device.platform
                else None,
                "peer_serial": peer_device.serial,
                "peer_sw_version": peer_device.sw_version,
            }
        )

    job = Job.objects.create(**job_data)
    logging.debug(f"Job ID: {job.pk}")

    try:
        job.job_status = "running"
        job.save()

        # Run the PAN-OS upgrade script
        job_status = run_upgrade_device(
            author_id=author_id,
            device_uuid=device_uuid,
            dry_run=dry_run,
            job_id=job.task_id,
            profile_uuid=profile_uuid,
            target_version=target_version,
        )

        if job_status == "errored":
            job.job_status = "errored"
        elif job_status == "skipped":
            job.job_status = "skipped"
        else:
            job.job_status = "completed"

    except WorkerTerminate as e:
        job.job_status = "errored"
        logging.debug(f"Job ID: {job.pk}\nError: {e}")
        logging.error(f"Exception Type: {type(e).__name__}")
        logging.error(f"Traceback: {traceback.format_exc()}")

    except Exception as e:
        job.job_status = "errored"
        logging.debug(f"Job ID: {job.pk}\nError: {e}")
        logging.error(f"Exception Type: {type(e).__name__}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        raise WorkerTerminate()

    finally:
        job.save()
