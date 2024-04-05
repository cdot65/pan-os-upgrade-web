# backend/panosupgradeweb/serializers.py

from rest_framework import serializers
from dj_rest_auth.serializers import TokenSerializer
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import (
    Device,
    DeviceType,
    Job,
    Profile,
)


class CustomTokenSerializer(TokenSerializer):
    author = serializers.SerializerMethodField()

    def get_author(self, obj):
        user = obj.user
        return user.id

    class Meta(TokenSerializer.Meta):
        fields = TokenSerializer.Meta.fields + ("author",)


class DeviceSerializer(serializers.ModelSerializer):
    app_version = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    device_group = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    device_type = serializers.CharField(
        source="platform.device_type",
        read_only=True,
    )
    ha_mode = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    ha_peer = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    ha_status = serializers.CharField(
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
    serial = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    sw_version = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    threat_version = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )
    uptime = serializers.CharField(
        allow_blank=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Device
        fields = (
            "app_version",
            "created_at",
            "device_group",
            "device_type",
            "ha",
            "ha_mode",
            "ha_peer",
            "ha_status",
            "hostname",
            "ipv4_address",
            "ipv6_address",
            "notes",
            "panorama_appliance",
            "panorama_managed",
            "platform_name",
            "serial",
            "sw_version",
            "threat_version",
            "uptime",
            "uuid",
        )

    def create(self, validated_data):
        platform_name = self.initial_data.get("platform_name")
        if platform_name:
            try:
                platform = DeviceType.objects.get(name=platform_name)
                validated_data["platform"] = platform
            except DeviceType.DoesNotExist:
                raise serializers.ValidationError("Invalid platform")
        return super().create(validated_data)

    def update(self, instance, validated_data):
        platform_name = self.initial_data.get("platform_name")
        if platform_name:
            try:
                platform = DeviceType.objects.get(name=platform_name)
                instance.platform = platform
            except DeviceType.DoesNotExist:
                raise serializers.ValidationError("Invalid platform")
        return super().update(instance, validated_data)


class DeviceTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceType
        fields = (
            "device_type",
            "id",
            "name",
        )


class InventorySyncSerializer(serializers.Serializer):
    author = serializers.IntegerField(required=True)
    panorama_device = serializers.UUIDField(required=True)
    profile = serializers.UUIDField(required=True)


class JobSerializer(serializers.ModelSerializer):
    task_id = serializers.CharField(read_only=True)

    class Meta:
        model = Job
        fields = (
            "task_id",
            "author",
            "created_at",
            "updated_at",
            "job_type",
            "json_data",
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


class ProfileSerializer(serializers.ModelSerializer):
    authentication = serializers.SerializerMethodField()
    download = serializers.SerializerMethodField()
    install = serializers.SerializerMethodField()
    readiness_checks = serializers.SerializerMethodField()
    reboot = serializers.SerializerMethodField()
    snapshots = serializers.SerializerMethodField()
    timeout_settings = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = (
            "uuid",
            "description",
            "name",
            "authentication",
            "download",
            "install",
            "readiness_checks",
            "reboot",
            "snapshots",
            "timeout_settings",
        )

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
        authentication_data = data.get("authentication", {})
        download_data = data.get("download", {})
        install_data = data.get("install", {})
        readiness_checks_data = data.get("readiness_checks", {})
        reboot_data = data.get("reboot", {})
        snapshots_data = data.get("snapshots", {})
        timeout_settings_data = data.get("timeout_settings", {})

        internal_value = super().to_internal_value(data)
        internal_value.update(
            {
                "pan_username": authentication_data.get("pan_username"),
                "pan_password": authentication_data.get("pan_password"),
                "max_download_tries": download_data.get("max_download_tries"),
                "download_retry_interval": download_data.get("download_retry_interval"),
                "max_install_attempts": install_data.get("max_install_attempts"),
                "install_retry_interval": install_data.get("install_retry_interval"),
                "readiness_checks_location": readiness_checks_data.get(
                    "readiness_checks_location"
                ),
                "active_support_check": readiness_checks_data.get("checks", {}).get(
                    "active_support_check"
                ),
                "arp_entry_exist_check": readiness_checks_data.get("checks", {}).get(
                    "arp_entry_exist_check"
                ),
                "candidate_config_check": readiness_checks_data.get("checks", {}).get(
                    "candidate_config_check"
                ),
                "certificates_requirements_check": readiness_checks_data.get(
                    "checks", {}
                ).get("certificates_requirements_check"),
                "content_version_check": readiness_checks_data.get("checks", {}).get(
                    "content_version_check"
                ),
                "dynamic_updates_check": readiness_checks_data.get("checks", {}).get(
                    "dynamic_updates_check"
                ),
                "expired_licenses_check": readiness_checks_data.get("checks", {}).get(
                    "expired_licenses_check"
                ),
                "free_disk_space_check": readiness_checks_data.get("checks", {}).get(
                    "free_disk_space_check"
                ),
                "ha_check": readiness_checks_data.get("checks", {}).get("ha_check"),
                "ip_sec_tunnel_status_check": readiness_checks_data.get(
                    "checks", {}
                ).get("ip_sec_tunnel_status_check"),
                "jobs_check": readiness_checks_data.get("checks", {}).get("jobs_check"),
                "ntp_sync_check": readiness_checks_data.get("checks", {}).get(
                    "ntp_sync_check"
                ),
                "panorama_check": readiness_checks_data.get("checks", {}).get(
                    "panorama_check"
                ),
                "planes_clock_sync_check": readiness_checks_data.get("checks", {}).get(
                    "planes_clock_sync_check"
                ),
                "session_exist_check": readiness_checks_data.get("checks", {}).get(
                    "session_exist_check"
                ),
                "max_reboot_tries": reboot_data.get("max_reboot_tries"),
                "reboot_retry_interval": reboot_data.get("reboot_retry_interval"),
                "snapshots_location": snapshots_data.get("snapshots_location"),
                "max_snapshot_tries": snapshots_data.get("max_snapshot_tries"),
                "snapshot_retry_interval": snapshots_data.get(
                    "snapshot_retry_interval"
                ),
                "arp_table_snapshot": snapshots_data.get("state", {}).get(
                    "arp_table_snapshot"
                ),
                "content_version_snapshot": snapshots_data.get("state", {}).get(
                    "content_version_snapshot"
                ),
                "ip_sec_tunnels_snapshot": snapshots_data.get("state", {}).get(
                    "ip_sec_tunnels_snapshot"
                ),
                "license_snapshot": snapshots_data.get("state", {}).get(
                    "license_snapshot"
                ),
                "nics_snapshot": snapshots_data.get("state", {}).get("nics_snapshot"),
                "routes_snapshot": snapshots_data.get("state", {}).get(
                    "routes_snapshot"
                ),
                "session_stats_snapshot": snapshots_data.get("state", {}).get(
                    "session_stats_snapshot"
                ),
                "command_timeout": timeout_settings_data.get("command_timeout"),
                "connection_timeout": timeout_settings_data.get("connection_timeout"),
            }
        )
        return internal_value

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation["authentication"] = self.get_authentication(instance)
        return representation
