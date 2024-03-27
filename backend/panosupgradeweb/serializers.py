# backend/panosupgradeweb/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import (
    Firewall,
    InventoryPlatform,
    Job,
    Panorama,
)


class InventoryDetailSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    api_key = serializers.CharField()
    author = serializers.StringRelatedField()
    created_at = serializers.DateTimeField()
    hostname = serializers.CharField()
    ipv4_address = serializers.IPAddressField()
    ipv6_address = serializers.IPAddressField()
    notes = serializers.CharField()
    ha = serializers.BooleanField()
    ha_peer = serializers.CharField()
    platform = serializers.SerializerMethodField()
    inventory_type = serializers.SerializerMethodField()

    def get_platform(self, obj):
        if isinstance(obj, Panorama):
            return obj.platform.name if obj.platform else None
        elif isinstance(obj, Firewall):
            return obj.platform.name if obj.platform else None
        return None

    def get_inventory_type(self, obj):
        if isinstance(obj, Panorama):
            return "panorama"
        elif isinstance(obj, Firewall):
            return "firewall"
        return None


class InventoryListSerializer(serializers.Serializer):
    uuid = serializers.UUIDField()
    api_key = serializers.CharField()
    author = serializers.StringRelatedField()
    created_at = serializers.DateTimeField()
    hostname = serializers.CharField()
    ipv4_address = serializers.IPAddressField()
    ipv6_address = serializers.IPAddressField()
    notes = serializers.CharField()
    ha = serializers.BooleanField()
    ha_peer = serializers.CharField()
    platform = serializers.SerializerMethodField()
    inventory_type = serializers.SerializerMethodField()

    def get_platform(self, obj):
        if isinstance(obj, Panorama):
            return obj.platform.name if obj.platform else None
        elif isinstance(obj, Firewall):
            return obj.platform.name if obj.platform else None
        return None

    def get_inventory_type(self, obj):
        if isinstance(obj, Panorama):
            return "panorama"
        elif isinstance(obj, Firewall):
            return "firewall"
        return None


class InventoryItemSerializer(serializers.ModelSerializer):
    platform = serializers.SerializerMethodField()
    inventory_type = serializers.SerializerMethodField()

    class Meta:
        model = None
        fields = (
            "uuid",
            "api_key",
            "author",
            "created_at",
            "hostname",
            "ipv4_address",
            "ipv6_address",
            "notes",
            "ha",
            "ha_peer",
            "platform",
            "inventory_type",
        )

    def get_platform(self, obj):
        if isinstance(obj, Panorama):
            return obj.platform.name if obj.platform else None
        elif isinstance(obj, Firewall):
            return obj.platform.name if obj.platform else None
        return None

    def get_inventory_type(self, obj):
        if isinstance(obj, Panorama):
            return "panorama"
        elif isinstance(obj, Firewall):
            return "firewall"
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

    def create(self, validated_data):
        platform_name = validated_data.pop("platform_name", None)
        if platform_name:
            try:
                platform = InventoryPlatform.objects.get(name=platform_name)
                validated_data["platform"] = platform
            except InventoryPlatform.DoesNotExist:
                raise serializers.ValidationError("Invalid platform")
        return super().create(validated_data)

    class Meta(InventoryItemSerializer.Meta):
        model = Panorama
        fields = InventoryItemSerializer.Meta.fields + ("platform_name",)


class FirewallSerializer(InventoryItemSerializer):
    platform_name = serializers.CharField(source="platform.name", required=False)
    device_group = serializers.CharField(allow_blank=True, required=False)

    def create(self, validated_data):
        platform_name = validated_data.pop("platform_name", None)
        if platform_name:
            try:
                platform = InventoryPlatform.objects.get(name=platform_name)
                validated_data["platform"] = platform
            except InventoryPlatform.DoesNotExist:
                raise serializers.ValidationError("Invalid platform")
        return super().create(validated_data)

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
