from django.contrib import admin
from .models import (
    InventoryItem,
    InventoryPlatform,
)


class InventoryItemAdmin(admin.ModelAdmin):
    list_display = (
        "hostname",
        "device_group",
        "ha",
        "ha_peer",
        "ipv4_address",
        "ipv6_address",
        "panorama_appliance",
        "panorama_managed",
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


admin.site.register(InventoryPlatform, InventoryPlatformAdmin)
