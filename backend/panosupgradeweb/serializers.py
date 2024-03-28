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
    author = serializers.StringRelatedField()
    created_at = serializers.DateTimeField()
    device_type = serializers.SerializerMethodField()
    ha = serializers.BooleanField()
    ha_peer = serializers.CharField()
    hostname = serializers.CharField()
    ipv4_address = serializers.IPAddressField()
    ipv6_address = serializers.IPAddressField()
    notes = serializers.CharField()
    platform = serializers.SerializerMethodField()
    uuid = serializers.UUIDField()

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
    author = serializers.StringRelatedField()
    created_at = serializers.DateTimeField()
    device_type = serializers.SerializerMethodField()
    ha = serializers.BooleanField()
    ha_peer = serializers.CharField()
    hostname = serializers.CharField()
    ipv4_address = serializers.IPAddressField()
    ipv6_address = serializers.IPAddressField()
    notes = serializers.CharField()
    platform = serializers.SerializerMethodField()
    uuid = serializers.UUIDField()

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
    device_type = serializers.SerializerMethodField()
    platform = serializers.SerializerMethodField()

    class Meta:
        model = None
        fields = (
            "author",
            "created_at",
            "device_type",
            "ha",
            "ha_peer",
            "hostname",
            "ipv4_address",
            "ipv6_address",
            "notes",
            "platform",
            "uuid",
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
            "device_type",
            "id",
            "name",
        )


class PanoramaSerializer(InventoryItemSerializer):
    platform_name = serializers.CharField(
        source="platform.name",
        required=False,
    )
    ha_peer = serializers.CharField(
        source="haPeer",
        allow_blank=True,
        required=False,
    )
    ipv4_address = serializers.IPAddressField(
        source="ipv4Address",
        required=True,
    )
    ipv6_address = serializers.IPAddressField(
        source="ipv6Address",
        allow_blank=True,
        required=False,
    )
    device_type = serializers.CharField(
        source="deviceType",
        required=False,
    )

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
    """
    Serializer class for Firewall objects.

    This serializer is used to convert Firewall objects to JSON representation and vice versa.
    It inherits from the InventoryItemSerializer class and adds additional fields specific to Firewall objects.

    Attributes:
        platform_name (serializers.CharField): The name of the platform associated with the Firewall.
        device_group (serializers.CharField): The device group of the Firewall.
        ha_peer (serializers.CharField): The HA peer of the Firewall.
        ipv4_address (serializers.IPAddressField): The IPv4 address of the Firewall.
        ipv6_address (serializers.IPAddressField): The IPv6 address of the Firewall.

    Methods:
        to_internal_value(data): Maps the field names from the payload to the model field names.
        create(validated_data): Creates a new Firewall object with the validated data.

    """

    device_group = serializers.CharField(
        allow_blank=True,
        required=False,
    )
    ha_peer = serializers.CharField(
        allow_blank=True,
        required=False,
    )
    ipv4_address = serializers.IPAddressField(
        required=True,
    )
    ipv6_address = serializers.IPAddressField(
        allow_blank=True,
        required=False,
    )
    panorama_appliance = serializers.CharField(
        allow_blank=True,
        required=False,
    )
    panorama_managed = serializers.BooleanField(
        required=False,
    )
    platform_name = serializers.CharField(
        source="platform.name",
        required=False,
    )

    def to_internal_value(self, data):
        """
        Maps the field names from the payload to the model field names.

        Args:
            data (dict): The input data containing the field names from the payload.

        Returns:
            dict: The modified data with the field names mapped to the model field names.

        """
        data["device_group"] = data.pop("deviceGroup", None)
        data["panorama_appliance"] = data.pop("panoramaAppliance", None)
        data["panorama_managed"] = data.pop("panoramaManaged", None)
        data["ha_peer"] = data.pop("haPeer", None)
        data["ipv4_address"] = data.pop("ipv4Address", None)
        data["ipv6_address"] = data.pop("ipv6Address", None)
        data.pop("deviceType", None)
        return super().to_internal_value(data)

    def create(self, validated_data):
        """
        Creates a new Firewall object with the validated data.

        Args:
            validated_data (dict): The validated data for creating the Firewall object.

        Returns:
            Firewall: The created Firewall object.

        Raises:
            serializers.ValidationError: If the platform name is invalid.

        """
        platform_name = validated_data.pop("platform.name", None)
        if platform_name:
            try:
                platform = InventoryPlatform.objects.get(name=platform_name)
                validated_data["platform"] = platform
            except InventoryPlatform.DoesNotExist:
                raise serializers.ValidationError("Invalid platform")

        return super().create(validated_data)

    class Meta(InventoryItemSerializer.Meta):
        model = Firewall
        fields = InventoryItemSerializer.Meta.fields + (
            "device_group",
            "panorama_appliance",
            "panorama_managed",
            "platform_name",
        )


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
