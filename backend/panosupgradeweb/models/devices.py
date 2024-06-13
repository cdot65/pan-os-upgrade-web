# backend/panosupgradeweb/models/devices.py

import uuid
from django.conf import settings
from django.db import models


class DeviceType(models.Model):
    device_type = models.CharField(
        max_length=32,
        verbose_name="Device Type",
    )
    name = models.CharField(
        max_length=32,
        unique=True,
        verbose_name="Platform",
    )

    def __str__(self) -> str:
        return str(self.name)


class Device(models.Model):
    app_version = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="App Version",
    )
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
    ha_enabled = models.BooleanField(
        null=True,
        verbose_name="HA Enabled",
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
    local_state = models.CharField(
        max_length=20,
        choices=(
            ("active", "Active"),
            ("passive", "Passive"),
            ("active-primary", "Active-Primary"),
            ("active-secondary", "Active-Secondary"),
        ),
        blank=True,
        null=True,
        verbose_name="Local HA State",
    )
    notes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Notes",
    )
    panorama_appliance = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name="+",
        verbose_name="Panorama Appliance",
    )
    panorama_managed = models.BooleanField(
        null=True,
        verbose_name="Panorama Managed",
    )
    panorama_ipv4_address = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Panorama IPv4 Address",
    )
    panorama_ipv6_address = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Panorama IPv6 Address",
    )
    peer_device = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        blank=True,
        null=True,
        related_name="+",
        verbose_name="Peer Device",
    )
    peer_ip = models.GenericIPAddressField(
        protocol="IPv4",
        blank=True,
        null=True,
        verbose_name="Peer IP Address",
    )
    peer_state = models.CharField(
        max_length=20,
        choices=(
            ("active", "Active"),
            ("passive", "Passive"),
            ("active-primary", "Active-Primary"),
            ("active-secondary", "Active-Secondary"),
        ),
        blank=True,
        null=True,
        verbose_name="Peer HA State",
    )
    platform = models.ForeignKey(
        DeviceType,
        blank=True,
        null=True,
        on_delete=models.CASCADE,
        verbose_name="Platform",
    )
    serial = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Serial",
    )
    sw_version = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Software Version",
    )
    threat_version = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Threat Version",
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        editable=False,
        verbose_name="Updated At",
    )
    uptime = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Uptime",
    )
    uuid = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="UUID",
    )

    def __str__(self) -> str:
        return str(self.hostname)

    def __getitem__(self, key):
        return getattr(self, key)
