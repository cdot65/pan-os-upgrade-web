# backend/panosupgradeweb/models.py

import uuid
from django.conf import settings
from django.db import models
from django.db.models import Q


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


class Job(models.Model):
    task_id = models.CharField(max_length=255, unique=True, primary_key=True)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
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


class Profile(models.Model):
    active_support_check = models.BooleanField(
        verbose_name="Active Support Check",
    )
    arp_entry_exist_check = models.BooleanField(
        verbose_name="ARP Entry Exist Check",
    )
    arp_table_snapshot = models.BooleanField(
        verbose_name="ARP Table Snapshot",
    )
    candidate_config_check = models.BooleanField(
        verbose_name="Candidate Config Check",
    )
    certificates_requirements_check = models.BooleanField(
        verbose_name="Certificates Requirements Check",
    )
    command_timeout = models.IntegerField(
        verbose_name="Command Timeout",
    )
    connection_timeout = models.IntegerField(
        verbose_name="Connection Timeout",
    )
    content_version_check = models.BooleanField(
        verbose_name="Content Version Check",
    )
    content_version_snapshot = models.BooleanField(
        verbose_name="Content Version Snapshot",
    )
    description = models.TextField(
        blank=True,
        null=True,
        verbose_name="Description",
    )
    download_retry_interval = models.IntegerField(
        verbose_name="Download Retry Interval",
    )
    dynamic_updates_check = models.BooleanField(
        verbose_name="Dynamic Updates Check",
    )
    expired_licenses_check = models.BooleanField(
        verbose_name="Expired Licenses Check",
    )
    free_disk_space_check = models.BooleanField(
        verbose_name="Free Disk Space Check",
    )
    ha_check = models.BooleanField(
        verbose_name="HA Check",
    )
    install_retry_interval = models.IntegerField(
        verbose_name="Install Retry Interval",
    )
    ip_sec_tunnel_status_check = models.BooleanField(
        verbose_name="IPSec Tunnel Status Check",
    )
    ip_sec_tunnels_snapshot = models.BooleanField(
        verbose_name="IPSec Tunnels Snapshot",
    )
    jobs_check = models.BooleanField(
        verbose_name="Jobs Check",
    )
    license_snapshot = models.BooleanField(
        verbose_name="License Snapshot",
    )
    max_download_tries = models.IntegerField(
        verbose_name="Max Download Tries",
    )
    max_install_attempts = models.IntegerField(
        verbose_name="Max Install Attempts",
    )
    max_reboot_tries = models.IntegerField(
        verbose_name="Max Reboot Tries",
    )
    max_snapshot_tries = models.IntegerField(
        verbose_name="Max Snapshot Tries",
    )
    name = models.CharField(
        max_length=255,
        unique=True,
        verbose_name="Profile Name",
    )
    nics_snapshot = models.BooleanField(
        verbose_name="NICs Snapshot",
    )
    ntp_sync_check = models.BooleanField(
        verbose_name="NTP Sync Check",
    )
    pan_password = models.CharField(
        max_length=255,
        verbose_name="PAN Password",
    )
    pan_username = models.CharField(
        max_length=255,
        verbose_name="PAN Username",
    )
    panorama_check = models.BooleanField(
        verbose_name="Panorama Check",
    )
    planes_clock_sync_check = models.BooleanField(
        verbose_name="Planes Clock Sync Check",
    )
    readiness_checks_location = models.CharField(
        max_length=255,
        verbose_name="Readiness Checks Location",
    )
    reboot_retry_interval = models.IntegerField(
        verbose_name="Reboot Retry Interval",
    )
    routes_snapshot = models.BooleanField(
        verbose_name="Routes Snapshot",
    )
    session_exist_check = models.BooleanField(
        verbose_name="Session Exist Check",
    )
    session_stats_snapshot = models.BooleanField(
        verbose_name="Session Stats Snapshot",
    )
    snapshot_retry_interval = models.IntegerField(
        verbose_name="Snapshot Retry Interval",
    )
    snapshots_location = models.CharField(
        max_length=255,
        verbose_name="Snapshots Location",
    )
    uuid = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="UUID",
    )
