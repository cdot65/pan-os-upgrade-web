from django.contrib import admin
from .models import (
    Device,
    DeviceType,
    HaDeployment,
    Job,
    Profile,
)


class HaDeploymentInline(admin.StackedInline):
    model = HaDeployment
    fk_name = "device"
    extra = 0


class DeviceAdmin(admin.ModelAdmin):
    list_display = (
        "hostname",
        "device_group",
        "ipv4_address",
        "ipv6_address",
        "panorama_appliance",
        "panorama_managed",
        "platform",
        "local_ha_state",
    )
    list_filter = ("platform", "device_group", "local_ha_state")
    search_fields = ("hostname", "ipv4_address", "ipv6_address", "notes")
    inlines = [HaDeploymentInline]


class DeviceTypeAdmin(admin.ModelAdmin):
    list_display = (
        "device_type",
        "name",
    )
    search_fields = (
        "device_type",
        "name",
    )


class HaDeploymentAdmin(admin.ModelAdmin):
    list_display = (
        "device",
        "peer_device",
        "peer_ip",
        "peer_hostname",
        "peer_state",
    )
    list_filter = ("peer_state",)
    search_fields = ("device__hostname", "peer_device__hostname", "peer_hostname")


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
admin.site.register(HaDeployment, HaDeploymentAdmin)
admin.site.register(Job, JobAdmin)
admin.site.register(Profile, ProfileAdmin)
