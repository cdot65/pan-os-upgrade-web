from django.contrib import admin
from .models import (
    Device,
    DeviceType,
    Job,
    Profile,
)


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


class ProfileAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "uuid",
        "description",
    )
    list_filter = ("name",)
    search_fields = ("name", "uuid", "description")


admin.site.register(Device, DeviceAdmin)
admin.site.register(DeviceType, DeviceTypeAdmin)
admin.site.register(Job, JobAdmin)
admin.site.register(Profile, ProfileAdmin)
