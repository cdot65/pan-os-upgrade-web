# backend/panosupgradeweb/scripts/panos_version_sync/app.py

from panosupgradeweb.models import Device, Job, Profile
from .device import PanosVersionSync


def main(author_id: int, device_uuid: str, job_id: str, profile_uuid: str) -> str:
    version_sync = PanosVersionSync(job_id)

    version_sync.logger.log_task(
        action="start",
        message=f"Running PAN-OS version sync for device: {device_uuid}",
    )
    version_sync.logger.log_task(
        action="info",
        message=f"Using profile: {profile_uuid}",
    )
    version_sync.logger.log_task(
        action="info",
        message=f"Author ID: {author_id}",
    )

    try:
        device = Device.objects.get(uuid=device_uuid)
        profile = Profile.objects.get(uuid=profile_uuid)
        job = Job.objects.get(task_id=job_id)

        synced_versions_count = version_sync.sync_available_versions(
            device_ip=device.ipv4_address,
            username=profile.pan_username,
            password=profile.pan_password,
            device_type=device.platform.device_type,
            author_id=author_id,
        )

        version_sync.logger.log_task(
            action="success",
            message=f"Successfully synced {synced_versions_count} PAN-OS versions to the database",
        )

        job.job_status = "completed"
        job.save()

        return "completed"

    except Exception as e:
        version_sync.logger.log_task(
            action="error",
            message=f"Error during PAN-OS version sync: {str(e)}",
        )
        job.job_status = "errored"
        job.save()
        return "errored"
