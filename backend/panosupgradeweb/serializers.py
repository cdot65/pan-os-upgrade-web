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


class InventoryItemSerializer(serializers.ModelSerializer):
    ipv6_address = serializers.IPAddressField(
        protocol="IPv6",
        allow_blank=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = None
        fields = (
            "api_key",
            "author",
            "created_at",
            "hostname",
            "ipv4_address",
            "ipv6_address",
            "notes",
            "uuid",
            "ha",
            "ha_peer",
        )


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
