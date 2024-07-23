# backend/panosupgradeweb/models/jobs.py

from django.conf import settings
from django.db import models


class Job(models.Model):
    task_id = models.CharField(max_length=255, unique=True, primary_key=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    current_device = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Current Device",
    )
    current_step = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Current Step",
    )
    job_status = models.CharField(
        max_length=20,
        choices=(
            ("completed", "Completed"),
            ("errored", "Errored"),
            ("pending", "Pending"),
            ("running", "Running"),
            ("skipped", "Skipped"),
        ),
        blank=True,
        null=True,
        verbose_name="Job Status",
    )
    job_type = models.CharField(
        max_length=20,
        choices=(
            ("upgrade", "Upgrade"),
            ("panorama_sync", "Panorama Sync"),
            ("device_refresh", "Device Refresh"),
        ),
        verbose_name="Job Type",
    )

    # Target device fields
    target_current_status = models.CharField(
        max_length=20,
        choices=(
            ("pending", "Pending"),
            ("working", "Working"),
            ("completed", "Completed"),
            ("errored", "Errored"),
        ),
        default="pending",
        verbose_name="Target Device Current Status",
    )
    target_device_group = models.CharField(max_length=100, blank=True, null=True)
    target_ha_enabled = models.BooleanField(null=True)
    target_hostname = models.CharField(max_length=100, blank=True, null=True)
    target_local_state = models.CharField(max_length=20, blank=True, null=True)
    target_panorama_managed = models.BooleanField(null=True)
    target_peer_device = models.CharField(max_length=100, blank=True, null=True)
    target_peer_state = models.CharField(max_length=20, blank=True, null=True)
    target_platform = models.CharField(max_length=100, blank=True, null=True)
    target_serial = models.CharField(max_length=100, blank=True, null=True)
    target_sw_version = models.CharField(max_length=100, blank=True, null=True)

    # Peer device fields
    peer_current_status = models.CharField(
        max_length=20,
        choices=(
            ("pending", "Pending"),
            ("working", "Working"),
            ("completed", "Completed"),
            ("errored", "Errored"),
        ),
        default="pending",
        verbose_name="Peer Device Current Status",
        null=True,
        blank=True,
    )
    peer_device_group = models.CharField(max_length=100, blank=True, null=True)
    peer_ha_enabled = models.BooleanField(null=True)
    peer_hostname = models.CharField(max_length=100, blank=True, null=True)
    peer_local_state = models.CharField(max_length=20, blank=True, null=True)
    peer_panorama_managed = models.BooleanField(null=True)
    peer_peer_device = models.CharField(max_length=100, blank=True, null=True)
    peer_peer_state = models.CharField(max_length=20, blank=True, null=True)
    peer_platform = models.CharField(max_length=100, blank=True, null=True)
    peer_serial = models.CharField(max_length=100, blank=True, null=True)
    peer_sw_version = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self) -> str:
        return str(self.task_id)


class JobLogEntry(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="log_entries")
    timestamp = models.DateTimeField()
    severity_level = models.CharField(
        max_length=20,
        choices=(
            ("debug", "Debug"),
            ("info", "Info"),
            ("warning", "Warning"),
            ("error", "Error"),
            ("critical", "Critical"),
        ),
        verbose_name="Severity Level",
    )
    message = models.CharField(max_length=40960)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        return f"{self.job.task_id} - {self.timestamp}"
