# backend/panosupgradeweb/models/snapshots.py

import uuid
from django.db import models
from .devices import Device
from .jobs import Job


class Snapshot(models.Model):
    uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="snapshots")
    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        related_name="snapshots",
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
        Snapshot,
        on_delete=models.CASCADE,
        related_name="content_versions",
    )
    version = models.CharField(max_length=100)


class License(models.Model):
    snapshot = models.ForeignKey(
        Snapshot,
        on_delete=models.CASCADE,
        related_name="licenses",
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
        Snapshot,
        on_delete=models.CASCADE,
        related_name="network_interfaces",
    )
    name = models.CharField(max_length=100)
    status = models.CharField(max_length=10)


class ArpTableEntry(models.Model):
    snapshot = models.ForeignKey(
        Snapshot,
        on_delete=models.CASCADE,
        related_name="arp_table_entries",
    )
    interface = models.CharField(max_length=100)
    ip = models.GenericIPAddressField()
    mac = models.CharField(max_length=17)
    port = models.CharField(max_length=100)
    status = models.CharField(max_length=1)
    ttl = models.IntegerField()


class Route(models.Model):
    snapshot = models.ForeignKey(
        Snapshot,
        on_delete=models.CASCADE,
        related_name="routes",
    )
    virtual_router = models.CharField(max_length=100)
    destination = models.CharField(max_length=100)
    nexthop = models.GenericIPAddressField()
    metric = models.IntegerField()
    flags = models.CharField(max_length=10)
    age = models.IntegerField(null=True, blank=True)
    interface = models.CharField(max_length=100, null=True, blank=True)
    route_table = models.CharField(max_length=20)


class SessionStats(models.Model):
    snapshot = models.ForeignKey(
        Snapshot,
        on_delete=models.CASCADE,
        related_name="session_stats",
    )
    age_accel_thresh = models.IntegerField()
    age_accel_tsf = models.IntegerField()
    age_scan_ssf = models.IntegerField()
    age_scan_thresh = models.IntegerField()
    age_scan_tmo = models.IntegerField()
    cps = models.IntegerField()
    dis_def = models.IntegerField()
    dis_sctp = models.IntegerField()
    dis_tcp = models.IntegerField()
    dis_udp = models.IntegerField()
    icmp_unreachable_rate = models.IntegerField()
    kbps = models.IntegerField()
    max_pending_mcast = models.IntegerField()
    num_active = models.IntegerField()
    num_bcast = models.IntegerField()
    num_gtpc = models.IntegerField()
    num_gtpu_active = models.IntegerField()
    num_gtpu_pending = models.IntegerField()
    num_http2_5gc = models.IntegerField()
    num_icmp = models.IntegerField()
    num_imsi = models.IntegerField()
    num_installed = models.IntegerField()
    num_max = models.IntegerField()
    num_mcast = models.IntegerField()
    num_pfcpc = models.IntegerField()
    num_predict = models.IntegerField()
    num_sctp_assoc = models.IntegerField()
    num_sctp_sess = models.IntegerField()
    num_tcp = models.IntegerField()
    num_udp = models.IntegerField()
    pps = models.IntegerField()
    tcp_cong_ctrl = models.IntegerField()
    tcp_reject_siw_thresh = models.IntegerField()
    tmo_5gcdelete = models.IntegerField()
    tmo_cp = models.IntegerField()
    tmo_def = models.IntegerField()
    tmo_icmp = models.IntegerField()
    tmo_sctp = models.IntegerField()
    tmo_sctpcookie = models.IntegerField()
    tmo_sctpinit = models.IntegerField()
    tmo_sctpshutdown = models.IntegerField()
    tmo_tcp = models.IntegerField()
    tmo_tcp_delayed_ack = models.IntegerField()
    tmo_tcp_unverif_rst = models.IntegerField()
    tmo_tcphalfclosed = models.IntegerField()
    tmo_tcphandshake = models.IntegerField()
    tmo_tcpinit = models.IntegerField()
    tmo_tcptimewait = models.IntegerField()
    tmo_udp = models.IntegerField()
    vardata_rate = models.IntegerField()
