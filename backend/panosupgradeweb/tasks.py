# backend/panosupgradeweb/tasks.py

import sys
import os
import django
import logging
import traceback

from celery import shared_task
from django.contrib.auth import get_user_model
from panosupgradeweb.models import Job

# import the inventory sync script
from panosupgradeweb.scripts import (
    run_inventory_sync,
    run_device_refresh,
    run_upgrade_device,
)

from celery.exceptions import Ignore, WorkerTerminate

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
        author=author,
        job_status="pending",
        job_type="device_upgrade",
        task_id=self.request.id,
    )
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
