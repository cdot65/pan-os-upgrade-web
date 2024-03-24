from django.contrib import admin
from .models import (
    Firewall,
    FirewallPlatform,
    Jobs,
    Panorama,
    PanoramaPlatform,
)


class FirewallAdmin(admin.ModelAdmin):
    list_display = (
        "hostname",
        "ipv4_address",
        "ipv6_address",
        "platform",
        "device_group",
        "ha",
        "ha_peer",
    )
    list_filter = ("platform", "device_group", "ha")
    search_fields = ("hostname", "ipv4_address", "ipv6_address", "notes")


class FirewallPlatformAdmin(admin.ModelAdmin):
    list_display = ("name", "vendor")
    search_fields = ("name", "vendor")


class PanoramaAdmin(admin.ModelAdmin):
    list_display = (
        "hostname",
        "ipv4_address",
        "ipv6_address",
        "platform",
        "ha",
        "ha_peer",
    )
    list_filter = ("platform", "ha")
    search_fields = ("hostname", "ipv4_address", "ipv6_address", "notes")


class PanoramaPlatformAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


class JobsAdmin(admin.ModelAdmin):
    list_display = ("task_id", "job_type", "author", "created_at")
    list_filter = ("job_type", "author")
    search_fields = ("task_id", "job_type")


admin.site.register(Firewall, FirewallAdmin)
admin.site.register(FirewallPlatform, FirewallPlatformAdmin)
admin.site.register(Panorama, PanoramaAdmin)
admin.site.register(PanoramaPlatform, PanoramaPlatformAdmin)
admin.site.register(Jobs, JobsAdmin)
