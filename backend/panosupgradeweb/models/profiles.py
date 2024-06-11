# backend/panosupgradeweb/models/profiles.py

import uuid
from django.db import models


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
