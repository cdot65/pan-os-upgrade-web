# backend/panosupgradeweb/models.py

import uuid
from django.conf import settings
from django.db import models


class InventoryItem(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    hostname = models.CharField(max_length=100, unique=True)
    notes = models.TextField(blank=True, null=True)
    ipv4_address = models.GenericIPAddressField()
    ipv6_address = models.GenericIPAddressField(protocol="IPv6", blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ha = models.BooleanField(default=False)
    ha_peer = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.hostname


class InventoryPlatform(models.Model):
    name = models.CharField(max_length=32, unique=True)
    device_type = models.CharField(max_length=32)

    def __str__(self):
        return self.name


class Firewall(InventoryItem):
    platform = models.ForeignKey(
        InventoryPlatform, blank=True, null=True, on_delete=models.CASCADE
    )
    device_group = models.CharField(max_length=100, blank=True, null=True)


class Panorama(InventoryItem):
    platform = models.ForeignKey(
        InventoryPlatform, blank=True, null=True, on_delete=models.CASCADE
    )


class Job(models.Model):
    task_id = models.CharField(max_length=255, unique=True, primary_key=True)
    job_type = models.CharField(max_length=1024)
    json_data = models.JSONField(null=True, blank=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.task_id
