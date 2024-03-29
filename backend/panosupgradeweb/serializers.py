# backend/panosupgradeweb/serializers.py

from rest_framework import serializers
from dj_rest_auth.serializers import TokenSerializer
from django.contrib.auth import get_user_model
from django.conf import settings
from .models import (
    InventoryItem,
    InventoryPlatform,
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
        required=False,
    )

    class Meta:
        model = InventoryItem
        fields = (
            # "author",
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
        data["device_type"] = data.pop("deviceType", None)
        return super().to_internal_value(data)

    def create(self, validated_data):
        platform_name = validated_data.pop("platform.name", None)
        if platform_name:
            try:
                platform = InventoryPlatform.objects.get(name=platform_name)
                validated_data["platform"] = platform
            except InventoryPlatform.DoesNotExist:
                raise serializers.ValidationError("Invalid platform")
        return super().create(validated_data)

    def update(self, instance, validated_data):
        platform_name = validated_data.pop("platform.name", None)
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
