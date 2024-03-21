import sys
import os
import django
import logging
import traceback

from celery import shared_task
from django.contrib.auth import get_user_model
from panosupgradeweb.models import Message, Conversation, Jobs

# third party library imports
from environs import Env

# import our python scripts
from panosupgradeweb.scripts import (
    run_assurance,
    run_get_system_info,
)

# ----------------------------------------------------------------------------
# Configure logging
# ----------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG, format="%(asctime)s [%(levelname)s] %(message)s"
)

# ----------------------------------------------------------------------------
# Load environment variables from .env file
# ----------------------------------------------------------------------------
env = Env()
env.read_env()

sendgrid_api_key = env(
    "SENDGRID_API_KEY",
    "go to https://docs.sendgrid.com/ui/account-and-settings/api-keys",
)

sys.path.append("/code/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_project.settings")
django.setup()
User = get_user_model()


# ----------------------------------------------------------------------------
# Get Panorama System Info
# ----------------------------------------------------------------------------
@shared_task(bind=True)
def execute_get_system_info(self, pan_url, api_key, author_id):
    # Retrieve the user object by id
    author = User.objects.get(id=author_id)

    # Create a new Jobs entry
    job = Jobs.objects.create(
        job_type="get_system_info",
        json_data=None,
        author=author,
        task_id=self.request.id,
    )

    try:
        system_info = run_get_system_info(pan_url, api_key)
        job.json_data = system_info
    except Exception as e:
        job.result = f"Job ID: {job.pk}\nError: {e}"

    # Save the updated job information
    job.save()


# ----------------------------------------------------------------------------
# Assurance: Check for ARP entry
# ----------------------------------------------------------------------------
@shared_task(bind=True)
def execute_assurance_arp(
    self,
    hostname,
    api_key,
    operation_type,
    action,
    config,
    author_id,
):
    # Retrieve the user object by id
    author = User.objects.get(id=author_id)

    # Create a new entry in our Jobs database table
    job = Jobs.objects.create(
        job_type="assurance_arp_entry",
        json_data=None,
        author=author,
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    # Execute the assurance check
    try:
        json_report = run_assurance(
            hostname,
            api_key,
            operation_type,
            action,
            config,
        )

        # logging.debug(json_report)
        job.json_data = json_report
        logging.debug(job)

    except Exception as e:
        logging.error(e)
        job.result = f"Job ID: {job.pk}\nError: {e}"

    # Save the updated job information
    job.save()


# ----------------------------------------------------------------------------
# Assurance: Readiness Check
# ----------------------------------------------------------------------------
@shared_task(bind=True)
def execute_assurance_readiness(
    self,
    hostname,
    api_key,
    operation_type,
    action,
    config,
    author_id,
):
    # Retrieve the user object by id
    author = User.objects.get(id=author_id)

    # Create a new entry in our Jobs database table
    job = Jobs.objects.create(
        job_type="assurance_readiness",
        json_data=None,
        author=author,
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    # Execute the assurance check
    try:
        json_report = run_assurance(
            hostname,
            api_key,
            operation_type,
            action,
            config,
        )

        # logging.debug(json_report)
        job.json_data = json_report
        logging.debug(job)

    except Exception as e:
        logging.error(e)
        job.result = f"Job ID: {job.pk}\nError: {e}"

    # Save the updated job information
    job.save()


# ----------------------------------------------------------------------------
# Assurance: Snapshot
# ----------------------------------------------------------------------------
@shared_task(bind=True)
def execute_assurance_snapshot(
    self,
    hostname,
    api_key,
    operation_type,
    action,
    config,
    author_id,
):
    # Retrieve the user object by id
    author = User.objects.get(id=author_id)

    # Create a new entry in our Jobs database table
    job = Jobs.objects.create(
        job_type="assurance_snapshot",
        json_data=None,
        author=author,
        task_id=self.request.id,
    )
    logging.debug(f"Job ID: {job.pk}")

    # Execute the assurance check
    try:
        json_report = run_assurance(
            hostname,
            api_key,
            operation_type,
            action,
            config,
        )

        # logging.debug(json_report)
        job.json_data = json_report
        logging.debug(job)

    except Exception as e:
        logging.error(e)
        job.result = f"Job ID: {job.pk}\nError: {e}"

    # Save the updated job information
    job.save()
