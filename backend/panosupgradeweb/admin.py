from django.contrib import admin
from .models import (
    Firewall,
    InventoryPlatform,
    # Job,
    Panorama,
)


class FirewallAdmin(admin.ModelAdmin):
    list_display = (
        "hostname",
        "device_group",
        "ha",
        "ha_peer",
        "ipv4_address",
        "ipv6_address",
        "platform",
    )
    list_filter = ("platform", "device_group", "ha")
    search_fields = ("hostname", "ipv4_address", "ipv6_address", "notes")


class InventoryPlatformAdmin(admin.ModelAdmin):
    list_display = (
        "device_type",
        "name",
    )
    search_fields = (
        "device_type",
        "name",
    )


class PanoramaAdmin(admin.ModelAdmin):
    list_display = (
        "hostname",
        "ha",
        "ha_peer",
        "ipv4_address",
        "ipv6_address",
        "platform",
    )
    list_filter = ("platform", "ha")
    search_fields = ("hostname", "ipv4_address", "ipv6_address", "notes")


# class JobAdmin(admin.ModelAdmin):
#     list_display = ("task_id", "job_type", "author", "created_at")
#     list_filter = ("job_type", "author")
#     search_fields = ("task_id", "job_type")


admin.site.register(Firewall, FirewallAdmin)
admin.site.register(InventoryPlatform, InventoryPlatformAdmin)
admin.site.register(Panorama, PanoramaAdmin)
# admin.site.register(Job, JobAdmin)
