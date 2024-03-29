# backend/panosupgradeweb/models.py

import uuid
from django.conf import settings
from django.db import models


class InventoryPlatform(models.Model):
    device_type = models.CharField(
        max_length=32,
        verbose_name="Device Type",
    )
    name = models.CharField(
        max_length=32,
        unique=True,
        verbose_name="Platform",
    )

    def __str__(self):
        return self.name


class InventoryItem(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        verbose_name="Author",
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        editable=False,
        verbose_name="Created At",
    )
    device_group = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Device Group",
    )
    ha = models.BooleanField(
        default=False,
        verbose_name="HA Enabled",
    )
    ha_peer = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="HA Peer",
    )
    hostname = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="Hostname",
    )
    ipv4_address = models.GenericIPAddressField(
        protocol="IPv4",
        blank=True,
        null=True,
        verbose_name="IPv4 Address",
    )
    ipv6_address = models.GenericIPAddressField(
        protocol="IPv6",
        blank=True,
        null=True,
        verbose_name="IPv6 Address",
    )
    notes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Notes",
    )
    panorama_appliance = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Panorama Appliance",
    )
    panorama_managed = models.BooleanField(
        default=False,
        null=True,
        verbose_name="Panorama Managed",
    )
    platform = models.ForeignKey(
        InventoryPlatform,
        blank=True,
        null=True,
        on_delete=models.CASCADE,
        verbose_name="Platform",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        editable=False,
        verbose_name="Updated At",
    )
    uuid = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="UUID",
    )

    def __str__(self):
        return self.hostname
