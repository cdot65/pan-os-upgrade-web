# backend/panosupgradeweb/models/jobs.py

from django.conf import settings
from django.db import models


class Job(models.Model):
    task_id = models.CharField(max_length=255, unique=True, primary_key=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
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

    # Device Object fields
    device_group = models.CharField(max_length=100, blank=True, null=True)
    ha_enabled = models.BooleanField(null=True)
    hostname = models.CharField(max_length=100, blank=True, null=True)
    local_state = models.CharField(max_length=20, blank=True, null=True)
    panorama_managed = models.BooleanField(null=True)
    peer_device = models.CharField(max_length=100, blank=True, null=True)
    peer_state = models.CharField(max_length=20, blank=True, null=True)
    platform = models.CharField(max_length=100, blank=True, null=True)
    serial = models.CharField(max_length=100, blank=True, null=True)
    sw_version = models.CharField(max_length=100, blank=True, null=True)

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
