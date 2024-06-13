# backend/panosupgradeweb/models/snapshots.py

import uuid
from django.db import models
from .devices import Device
from .jobs import Job


class Snapshot(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="snapshots")
    device = models.ForeignKey(
        Device, on_delete=models.CASCADE, related_name="snapshots"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    snapshot_type = models.CharField(
        max_length=20,
        choices=(
            ("pre_upgrade", "Pre-Upgrade"),
            ("post_upgrade", "Post-Upgrade"),
        ),
        default="pre_upgrade",
        verbose_name="Snapshot Type",
    )


class ContentVersion(models.Model):
    snapshot = models.ForeignKey(
        Snapshot, on_delete=models.CASCADE, related_name="content_versions"
    )
    version = models.CharField(max_length=100)


class License(models.Model):
    snapshot = models.ForeignKey(
        Snapshot, on_delete=models.CASCADE, related_name="licenses"
    )
    feature = models.CharField(max_length=100)
    description = models.TextField()
    serial = models.CharField(max_length=100)
    issued = models.CharField(max_length=100)
    expires = models.CharField(max_length=100)
    expired = models.CharField(max_length=10)
    base_license_name = models.CharField(max_length=100)
    authcode = models.CharField(max_length=100, null=True, blank=True)
    custom = models.JSONField(null=True, blank=True)


class NetworkInterface(models.Model):
    snapshot = models.ForeignKey(
        Snapshot, on_delete=models.CASCADE, related_name="network_interfaces"
    )
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=10)
