# backend/panosupgradeweb/serializers.py

from rest_framework import serializers
from dj_rest_auth.serializers import TokenSerializer
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import (
    Firewall,
    InventoryPlatform,
    Job,
    Panorama,
)


class CustomTokenSerializer(TokenSerializer):
    author = serializers.SerializerMethodField()

    def get_author(self, obj):
        user = obj.user
        return user.id

    class Meta(TokenSerializer.Meta):
        fields = TokenSerializer.Meta.fields + ("author",)


class InventoryDetailSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    author = serializers.StringRelatedField()
    created_at = serializers.DateTimeField()
    hostname = serializers.CharField()
    ipv4_address = serializers.IPAddressField()
    ipv6_address = serializers.IPAddressField()
    notes = serializers.CharField()
    ha = serializers.BooleanField()
    ha_peer = serializers.CharField()
    platform = serializers.SerializerMethodField()
    device_type = serializers.SerializerMethodField()

    def get_platform(self, obj):
        if isinstance(obj, Panorama):
            return obj.platform.name if obj.platform else None
        elif isinstance(obj, Firewall):
            return obj.platform.name if obj.platform else None
        return None

    def get_device_type(self, obj):
        if isinstance(obj, Panorama):
            return "Panorama"
        elif isinstance(obj, Firewall):
            return "Firewall"
        return None


class InventoryListSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    author = serializers.StringRelatedField()
    created_at = serializers.DateTimeField()
    hostname = serializers.CharField()
    ipv4_address = serializers.IPAddressField()
    ipv6_address = serializers.IPAddressField()
    notes = serializers.CharField()
    ha = serializers.BooleanField()
    ha_peer = serializers.CharField()
    platform = serializers.SerializerMethodField()
    device_type = serializers.SerializerMethodField()

    def get_platform(self, obj):
        if isinstance(obj, Panorama):
            return obj.platform.name if obj.platform else None
        elif isinstance(obj, Firewall):
            return obj.platform.name if obj.platform else None
        return None

    def get_device_type(self, obj):
        if isinstance(obj, Panorama):
            return "Panorama"
        elif isinstance(obj, Firewall):
            return "Firewall"
        return None


class InventoryItemSerializer(serializers.ModelSerializer):
    platform = serializers.SerializerMethodField()
    device_type = serializers.SerializerMethodField()

    class Meta:
        model = None
        fields = (
            "uuid",
            "author",
            "created_at",
            "hostname",
            "ipv4_address",
            "ipv6_address",
            "notes",
            "ha",
            "ha_peer",
            "platform",
            "device_type",
        )

    def get_platform(self, obj):
        if isinstance(obj, Panorama):
            return obj.platform.name if obj.platform else None
        elif isinstance(obj, Firewall):
            return obj.platform.name if obj.platform else None
        return None

    def get_device_type(self, obj):
        if isinstance(obj, Panorama):
            return "Panorama"
        elif isinstance(obj, Firewall):
            return "Firewall"
        return None


class InventoryPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = InventoryPlatform
        fields = (
            "id",
            "device_type",
            "name",
        )


class PanoramaSerializer(InventoryItemSerializer):
    platform_name = serializers.CharField(source="platform.name", required=False)
    ha_peer = serializers.CharField(source="haPeer", allow_blank=True, required=False)
    ipv4_address = serializers.IPAddressField(source="ipv4Address", required=True)
    ipv6_address = serializers.IPAddressField(
        source="ipv6Address", allow_blank=True, required=False
    )
    device_type = serializers.CharField(source="deviceType", required=False)

    def to_internal_value(self, data):
        data["ipv4_address"] = data.pop("ipv4Address", None)
        data["ipv6_address"] = data.pop("ipv6Address", None)
        data["ha_peer"] = data.pop("haPeer", None)
        data["device_type"] = data.pop("deviceType", None)
        return super().to_internal_value(data)

    class Meta(InventoryItemSerializer.Meta):
        model = Panorama
        fields = InventoryItemSerializer.Meta.fields + ("platform_name",)


class FirewallSerializer(InventoryItemSerializer):
    platform_name = serializers.CharField(source="platform.name", required=False)
    device_group = serializers.CharField(allow_blank=True, required=False)
    ha_peer = serializers.CharField(source="haPeer", allow_blank=True, required=False)
    ipv4_address = serializers.IPAddressField(source="ipv4Address", required=True)
    ipv6_address = serializers.IPAddressField(
        source="ipv6Address", allow_blank=True, required=False
    )
    device_type = serializers.CharField(source="deviceType", required=False)

    def to_internal_value(self, data):
        data["ipv4_address"] = data.pop("ipv4Address", None)
        data["ipv6_address"] = data.pop("ipv6Address", None)
        data["ha_peer"] = data.pop("haPeer", None)
        data["device_type"] = data.pop("deviceType", None)
        return super().to_internal_value(data)

    class Meta(InventoryItemSerializer.Meta):
        model = Firewall
        fields = InventoryItemSerializer.Meta.fields + ("platform_name", "device_group")


class JobSerializer(serializers.ModelSerializer):
    task_id = serializers.CharField(read_only=True)

    class Meta:
        model = Job
        fields = (
            "task_id",
            "job_type",
            "author",
            "created_at",
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
