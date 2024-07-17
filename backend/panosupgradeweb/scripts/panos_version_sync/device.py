# backend/panosupgradeweb/scripts/panos_version_sync/device.py

from panos.firewall import Firewall
from panos.panorama import Panorama
from panosupgradeweb.scripts.logger import PanOsUpgradeLogger
from panosupgradeweb.models import PanosVersion
from django.utils.dateparse import parse_datetime


class PanosVersionSync:
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.logger = PanOsUpgradeLogger("pan-os-upgrade-version-sync")
        self.logger.set_job_id(job_id)

    def sync_available_versions(
        self,
        device_ip: str,
        username: str,
        password: str,
        device_type: str,
        author_id: int,
    ):
        self.logger.log_task(
            action="start",
            message=f"Connecting to device {device_ip} to retrieve available PAN-OS versions",
        )

        try:
            if device_type == "Firewall":
                pan_device = Firewall(device_ip, username, password)
            elif device_type == "Panorama":
                pan_device = Panorama(device_ip, username, password)
            else:
                raise ValueError(f"Invalid device type: {device_type}")

            pan_device.software.check()
            available_versions = pan_device.software.versions

            self.logger.log_task(
                action="success",
                message=f"Successfully retrieved available PAN-OS versions from {device_ip}",
            )

            # Update or create PanosVersion objects
            for version_key, version_data in available_versions.items():
                PanosVersion.objects.update_or_create(
                    version=version_data["version"],
                    defaults={
                        "filename": version_data["filename"],
                        "size": version_data["size"],
                        "size_kb": version_data["size-kb"],
                        "released_on": version_data["released-on"],
                        "release_notes": version_data["release-notes"],
                        "downloaded": version_data["downloaded"],
                        "current": version_data["current"],
                        "latest": version_data["latest"],
                        "uploaded": version_data["uploaded"],
                        "author_id": author_id,
                    },
                )

            self.logger.log_task(
                action="success",
                message=f"Successfully synced {len(available_versions)} PAN-OS versions to the database",
            )

            return len(available_versions)

        except Exception as e:
            self.logger.log_task(
                action="error",
                message=f"Error retrieving and syncing available PAN-OS versions from {device_ip}: {str(e)}",
            )
            raise
