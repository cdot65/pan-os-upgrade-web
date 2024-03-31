# backend/panosupgradeweb/serializers.py

from rest_framework import serializers
from dj_rest_auth.serializers import TokenSerializer
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import (
    InventoryItem,
    InventoryPlatform,
    SettingsProfile,
)


class CustomTokenSerializer(TokenSerializer):
    author = serializers.SerializerMethodField()

    def get_author(self, obj):
        user = obj.user
        return user.id

    class Meta(TokenSerializer.Meta):
        fields = TokenSerializer.Meta.fields + ("author",)


class InventoryItemSerializer(serializers.ModelSerializer):
    device_group = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    device_type = serializers.CharField(
        source="platform.device_type",
        read_only=True,
    )
    ha_peer = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    ipv4_address = serializers.IPAddressField(
        required=True,
    )
    ipv6_address = serializers.IPAddressField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    panorama_appliance = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    panorama_managed = serializers.BooleanField(
        required=False,
        allow_null=True,
    )
    platform_name = serializers.CharField(
        source="platform.name",
        read_only=True,
    )

    class Meta:
        model = InventoryItem
        fields = (
            "created_at",
            "device_group",
            "device_type",
            "ha",
            "ha_peer",
            "hostname",
            "ipv4_address",
            "ipv6_address",
            "notes",
            "panorama_appliance",
            "panorama_managed",
            "platform_name",
            "uuid",
        )

    def to_internal_value(self, data):
        data["device_group"] = data.pop("deviceGroup", None)
        data["panorama_appliance"] = data.pop("panoramaAppliance", None)
        data["panorama_managed"] = data.pop("panoramaManaged", None)
        data["ha_peer"] = data.pop("haPeer", None)
        data["ipv4_address"] = data.pop("ipv4Address", None)
        data["ipv6_address"] = data.pop("ipv6Address", None)
        return super().to_internal_value(data)

    def create(self, validated_data):
        platform_name = self.initial_data.get("platformName")
        if platform_name:
            try:
                platform = InventoryPlatform.objects.get(name=platform_name)
                validated_data["platform"] = platform
            except InventoryPlatform.DoesNotExist:
                raise serializers.ValidationError("Invalid platform")
        return super().create(validated_data)

    def update(self, instance, validated_data):
        platform_name = self.initial_data.get("platformName")
        if platform_name:
            try:
                platform = InventoryPlatform.objects.get(name=platform_name)
                instance.platform = platform
            except InventoryPlatform.DoesNotExist:
                raise serializers.ValidationError("Invalid platform")
        return super().update(instance, validated_data)


class InventoryPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryPlatform
        fields = (
            "device_type",
            "id",
            "name",
        )


class UserSerializer(serializers.ModelSerializer):
    profile_image = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = (
            "id",
            "username",
            "email",
            "is_staff",
            "is_superuser",
            "profile_image",
        )
        read_only_fields = ("is_staff", "is_superuser")

    def get_profile_image(self, obj):
        if obj.profile_image:
            return settings.MEDIA_URL + str(obj.profile_image)
        return None


class SettingsProfileSerializer(serializers.ModelSerializer):
    download = serializers.SerializerMethodField()
    install = serializers.SerializerMethodField()
    readiness_checks = serializers.SerializerMethodField()
    reboot = serializers.SerializerMethodField()
    snapshots = serializers.SerializerMethodField()
    timeout_settings = serializers.SerializerMethodField()

    class Meta:
        model = SettingsProfile
        fields = (
            "uuid",
            "description",
            "profile",
            "pan_username",
            "pan_password",
            "download",
            "install",
            "readiness_checks",
            "reboot",
            "snapshots",
            "timeout_settings",
        )
        extra_kwargs = {
            "pan_password": {"write_only": True},
        }

    def create(self, validated_data):
        pan_username = validated_data.pop("pan_username", "")
        pan_password = validated_data.pop("pan_password", "")
        instance = super().create(validated_data)
        instance.pan_username = pan_username
        instance.pan_password = pan_password
        instance.save()
        return instance

    def update(self, instance, validated_data):
        pan_username = validated_data.pop("pan_username", "")
        pan_password = validated_data.pop("pan_password", "")
        instance = super().update(instance, validated_data)
        instance.pan_username = pan_username
        instance.pan_password = pan_password
        instance.save()
        return instance

    def get_authentication(self, obj):
        return {
            "pan_username": obj.pan_username,
            "pan_password": obj.pan_password,
        }

    def get_download(self, obj):
        return {
            "max_download_tries": obj.max_download_tries,
            "download_retry_interval": obj.download_retry_interval,
        }

    def get_install(self, obj):
        return {
            "max_install_attempts": obj.max_install_attempts,
            "install_retry_interval": obj.install_retry_interval,
        }

    def get_readiness_checks(self, obj):
        return {
            "checks": {
                "active_support_check": obj.active_support_check,
                "arp_entry_exist_check": obj.arp_entry_exist_check,
                "candidate_config_check": obj.candidate_config_check,
                "certificates_requirements_check": obj.certificates_requirements_check,
                "content_version_check": obj.content_version_check,
                "dynamic_updates_check": obj.dynamic_updates_check,
                "expired_licenses_check": obj.expired_licenses_check,
                "free_disk_space_check": obj.free_disk_space_check,
                "ha_check": obj.ha_check,
                "ip_sec_tunnel_status_check": obj.ip_sec_tunnel_status_check,
                "jobs_check": obj.jobs_check,
                "ntp_sync_check": obj.ntp_sync_check,
                "panorama_check": obj.panorama_check,
                "planes_clock_sync_check": obj.planes_clock_sync_check,
                "session_exist_check": obj.session_exist_check,
            },
            "readiness_checks_location": obj.readiness_checks_location,
        }

    def get_reboot(self, obj):
        return {
            "max_reboot_tries": obj.max_reboot_tries,
            "reboot_retry_interval": obj.reboot_retry_interval,
        }

    def get_snapshots(self, obj):
        return {
            "snapshots_location": obj.snapshots_location,
            "max_snapshot_tries": obj.max_snapshot_tries,
            "snapshot_retry_interval": obj.snapshot_retry_interval,
            "state": {
                "arp_table_snapshot": obj.arp_table_snapshot,
                "content_version_snapshot": obj.content_version_snapshot,
                "ip_sec_tunnels_snapshot": obj.ip_sec_tunnels_snapshot,
                "license_snapshot": obj.license_snapshot,
                "nics_snapshot": obj.nics_snapshot,
                "routes_snapshot": obj.routes_snapshot,
                "session_stats_snapshot": obj.session_stats_snapshot,
            },
        }

    def get_timeout_settings(self, obj):
        return {
            "command_timeout": obj.command_timeout,
            "connection_timeout": obj.connection_timeout,
        }

    def to_internal_value(self, data):
        data["pan_username"] = data.get("authentication", {}).get("pan_username")
        data["pan_password"] = data.get("authentication", {}).get("pan_password")
        data["max_download_tries"] = data.get("download", {}).get("max_download_tries")
        data["download_retry_interval"] = data.get("download", {}).get(
            "download_retry_interval"
        )
        data["max_install_attempts"] = data.get("install", {}).get(
            "max_install_attempts"
        )
        data["install_retry_interval"] = data.get("install", {}).get(
            "install_retry_interval"
        )
        data["readiness_checks_location"] = data.get("readiness_checks", {}).get(
            "readiness_checks_location"
        )
        data["max_reboot_tries"] = data.get("reboot", {}).get("max_reboot_tries")
        data["reboot_retry_interval"] = data.get("reboot", {}).get(
            "reboot_retry_interval"
        )
        data["snapshots_location"] = data.get("snapshots", {}).get("snapshots_location")
        data["max_snapshot_tries"] = data.get("snapshots", {}).get("max_snapshot_tries")
        data["snapshot_retry_interval"] = data.get("snapshots", {}).get(
            "snapshot_retry_interval"
        )
        data["command_timeout"] = data.get("timeout_settings", {}).get(
            "command_timeout"
        )
        data["connection_timeout"] = data.get("timeout_settings", {}).get(
            "connection_timeout"
        )
        return super().to_internal_value(data)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation["authentication"] = {
            "pan_username": instance.pan_username,
            "pan_password": "",
        }
        return representation
