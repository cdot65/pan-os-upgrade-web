# backend/panosupgradeweb/views.py

# django imports
from django.contrib.auth import get_user_model
from django.http import JsonResponse, Http404
from django.db.models.functions import Lower, Replace
from django.db.models import Value as V
from django.shortcuts import get_object_or_404

# django rest framework imports
from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.generics import RetrieveAPIView
from rest_framework.views import APIView
from rest_framework.serializers import ValidationError

# directory object imports
from .models import (
    Firewall,
    InventoryPlatform,
    Job,
    Panorama,
)
from .permissions import IsAuthorOrReadOnly
from .serializers import (
    InventoryDetailSerializer,
    InventoryListSerializer,
    PanoramaSerializer,
    InventoryPlatformSerializer,
    FirewallSerializer,
    JobSerializer,
    UserSerializer,
)


class InventoryExistsView(APIView):
    """
    A view that returns the existence of an inventory item by name as a boolean.
    """

    def get(self, request, format=None):
        raw_inventory_hostname = request.GET.get("hostname", None)
        if raw_inventory_hostname is not None:
            formatted_inventory_hostname = (
                raw_inventory_hostname.lower().replace(" ", "_").replace("-", "_")
            )
            exists = (
                (
                    Panorama.objects.annotate(
                        formatted_hostname=Replace(
                            Replace(Lower("hostname"), V(" "), V("_")), V("-"), V("_")
                        )
                    )
                    # trunk-ignore(flake8/W503)
                    | Firewall.objects.annotate(
                        formatted_hostname=Replace(
                            Replace(Lower("hostname"), V(" "), V("_")), V("-"), V("_")
                        )
                    )
                )
                .filter(formatted_hostname=formatted_inventory_hostname)
                .exists()
            )
            return Response(
                {"exists": exists, "formatted_value": formatted_inventory_hostname}
            )
        else:
            return Response(
                {"error": "No inventory hostname provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class InventoryViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)

    def get_queryset(self):
        if self.action == "list":
            return list(Panorama.objects.all()) + list(Firewall.objects.all())
        return self.queryset

    def get_object(self):
        uuid = self.kwargs.get("pk")

        panorama_obj = Panorama.objects.filter(uuid=uuid).first()
        if panorama_obj:
            return panorama_obj

        firewall_obj = Firewall.objects.filter(uuid=uuid).first()
        if firewall_obj:
            return firewall_obj

        raise Http404("Object not found.")

    def get_serializer_class(self):
        if self.action == "list":
            return InventoryListSerializer
        elif self.action == "retrieve":
            return InventoryDetailSerializer
        elif self.action == "create":
            device_type = self.request.data.get("device_type")
            if device_type == "panorama":
                return PanoramaSerializer
            elif device_type == "firewall":
                return FirewallSerializer
            else:
                raise ValidationError("Invalid inventory type")
        elif isinstance(self.get_object(), Panorama):
            return PanoramaSerializer
        elif isinstance(self.get_object(), Firewall):
            return FirewallSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        serializer_class = self.get_serializer_class()
        serializer = serializer_class(data=request.data)
        if serializer.is_valid():
            try:
                platform_name = request.data.get("platform")
                if platform_name:
                    platform = InventoryPlatform.objects.get(name=platform_name)
                    serializer.validated_data["platform"] = platform
                serializer.save(author=self.request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class InventoryPlatformViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = InventoryPlatform.objects.all()
    serializer_class = InventoryPlatformSerializer


class FirewallPlatformViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = InventoryPlatform.objects.filter(device_type="Firewall")
    serializer_class = InventoryPlatformSerializer


class PanoramaPlatformViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = InventoryPlatform.objects.filter(device_type="Panorama")
    serializer_class = InventoryPlatformSerializer


class JobViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = Job.objects.all()
    serializer_class = JobSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save(author=self.request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def retrieve(self, request, pk=None, format=None):
        instance = self.get_object()
        if instance.json_data is None:
            return JsonResponse({}, status=200)

        response_data = {
            "task_id": instance.task_id,
            "job_type": instance.job_type,
            "created_at": instance.created_at.isoformat(),
            "json_data": instance.json_data if instance.json_data is not None else {},
        }

        return JsonResponse(response_data, status=200)


class UserViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    queryset = get_user_model().objects.all()
    serializer_class = UserSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return get_user_model().objects.all()
        else:
            return get_user_model().objects.filter(id=user.id)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class UserProfileView(RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
