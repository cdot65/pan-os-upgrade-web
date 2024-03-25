# backend/panosupgradeweb/serializers.py

from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import (
    Panorama,
    PanoramaPlatform,
    Firewall,
    FirewallPlatform,
    Jobs,
)


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


class PanoramaPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = PanoramaPlatform
        fields = (
            "id",
            "name",
        )


class PanoramaSerializer(InventoryItemSerializer):
    platform = serializers.CharField(source="platform.name", read_only=True)

    def create(self, validated_data):
        return Panorama.objects.create(**validated_data)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

    class Meta(InventoryItemSerializer.Meta):
        model = Panorama
        fields = InventoryItemSerializer.Meta.fields + ("platform",)


class FirewallPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = FirewallPlatform
        fields = (
            "id",
            "name",
            "vendor",
        )


class FirewallSerializer(InventoryItemSerializer):
    platform = serializers.CharField(source="platform.name", read_only=True)
    device_group = serializers.CharField(allow_blank=True, required=False)

    def create(self, validated_data):
        return Firewall.objects.create(**validated_data)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

    class Meta(InventoryItemSerializer.Meta):
        model = Firewall
        fields = InventoryItemSerializer.Meta.fields + ("platform", "device_group")


class JobsSerializer(serializers.ModelSerializer):
    task_id = serializers.CharField(read_only=True)

    class Meta:
        model = Jobs
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
