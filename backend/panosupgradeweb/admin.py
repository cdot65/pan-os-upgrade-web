from django.contrib import admin
from .models.devices import Device, DeviceType
from .models.jobs import Job, JobLogEntry
from .models.profiles import Profile
from .models.snapshots import Snapshot, ContentVersion, License, NetworkInterface


class DeviceAdmin(admin.ModelAdmin):
    list_display = (
        "hostname",
        "device_group",
        "ha_enabled",
        "ipv4_address",
        "ipv6_address",
        "panorama_appliance",
        "panorama_managed",
        "platform",
        "peer_device",
        "peer_ip",
        "peer_state",
        "local_state",
    )
    list_filter = (
        "platform",
        "device_group",
        "ha_enabled",
        "peer_state",
        "local_state",
    )
    search_fields = (
        "hostname",
        "ipv4_address",
        "ipv6_address",
        "notes",
        "peer_device__hostname",
    )


class DeviceTypeAdmin(admin.ModelAdmin):
    list_display = (
        "device_type",
        "name",
    )
    search_fields = (
        "device_type",
        "name",
    )


class JobAdmin(admin.ModelAdmin):
    list_display = (
        "job_type",
        "author",
        "created_at",
        "updated_at",
    )
    list_filter = ("job_type", "author")
    search_fields = ("job_type", "author")


class JobLogEntryAdmin(admin.ModelAdmin):
    list_display = (
        "job",
        "timestamp",
        "severity_level",
        "message",
    )
    list_filter = ("job", "severity_level")
    search_fields = ("job__task_id", "message")


class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "uuid",
        "description",
    )
    list_filter = ("name",)
    search_fields = ("name", "uuid", "description")


class SnapshotAdmin(admin.ModelAdmin):
    list_display = (
        "uuid",
        "job",
        "device",
        "created_at",
        "snapshot_type",
    )
    list_filter = ("job", "device", "snapshot_type")
    search_fields = ("uuid", "job__task_id", "device__hostname")


class ContentVersionAdmin(admin.ModelAdmin):
    list_display = (
        "snapshot",
        "version",
    )
    search_fields = ("snapshot__uuid", "version")


class LicenseAdmin(admin.ModelAdmin):
    list_display = (
        "snapshot",
        "feature",
        "serial",
        "issued",
        "expires",
        "expired",
    )
    list_filter = ("expired",)
    search_fields = ("snapshot__uuid", "feature", "serial")


class NetworkInterfaceAdmin(admin.ModelAdmin):
    list_display = (
        "snapshot",
        "name",
        "status",
    )
    list_filter = ("status",)
    search_fields = ("snapshot__uuid", "name")


admin.site.register(Device, DeviceAdmin)
admin.site.register(DeviceType, DeviceTypeAdmin)
admin.site.register(Job, JobAdmin)
admin.site.register(JobLogEntry, JobLogEntryAdmin)
admin.site.register(Profile, ProfileAdmin)
admin.site.register(Snapshot, SnapshotAdmin)
admin.site.register(ContentVersion, ContentVersionAdmin)
admin.site.register(License, LicenseAdmin)
admin.site.register(NetworkInterface, NetworkInterfaceAdmin)
