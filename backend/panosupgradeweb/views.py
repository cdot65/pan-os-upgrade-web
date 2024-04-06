# backend/panosupgradeweb/views.py

# django imports
from django.contrib.auth import get_user_model
from django.http import JsonResponse, Http404
from django.db.models.functions import Lower, Replace
from django.db.models import Value as V
from django.shortcuts import get_object_or_404

# django rest framework imports
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.generics import RetrieveAPIView
from rest_framework.response import Response
from rest_framework.serializers import ValidationError
from rest_framework.views import APIView

# directory object imports
from .models import (
    DeviceType,
    Device,
    Job,
    Profile,
)
from .permissions import IsAuthorOrReadOnly
from .serializers import (
    DeviceSerializer,
    DeviceRefreshSerializer,
    DeviceTypeSerializer,
    InventorySyncSerializer,
    JobSerializer,
    ProfileSerializer,
    UserSerializer,
)
from .tasks import (
    execute_inventory_sync,
    refresh_device_task,
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
                    Device.objects.annotate(
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
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer

    def get_queryset(self):
        queryset = Device.objects.all()
        device_type = self.request.query_params.get("device_type", None)
        if device_type is not None:
            queryset = queryset.filter(platform__device_type=device_type)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            try:
                platform_name = request.data.get("platform")
                if platform_name:
                    platform = DeviceType.objects.get(name=platform_name)
                    serializer.validated_data["platform"] = platform
                serializer.save(author=request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="job-status")
    def get_job_status(self, request):
        job_id = request.query_params.get("job_id")
        if job_id:
            try:
                job = Job.objects.get(task_id=job_id)
                # Check the status of the job based on the job object
                if job.json_data:
                    status = "completed"
                else:
                    status = "running"

                return JsonResponse({"job_id": job_id, "status": status})
            except Job.DoesNotExist:
                return JsonResponse({"error": "Invalid job ID."}, status=400)
        else:
            return JsonResponse({"error": "Missing job ID."}, status=400)

    @action(detail=False, methods=["post"], url_path="refresh")
    def refresh_device(self, request):
        serializer = DeviceRefreshSerializer(data=request.data)
        if serializer.is_valid():
            device_uuid = serializer.validated_data["device"]
            profile_uuid = serializer.validated_data["profile"]
            author_id = serializer.validated_data["author"]

            try:
                device = Device.objects.get(uuid=device_uuid)
                profile = Profile.objects.get(uuid=profile_uuid)

                print(f"Refreshing device {device.hostname}...")
                print(f"Profile: {profile.name}")

                # Trigger the Celery task for device refresh and get the task ID
                task = refresh_device_task.delay(
                    device_uuid,
                    profile_uuid,
                    author_id,
                )

                return Response(
                    {"job_id": task.id},
                    status=status.HTTP_200_OK,
                )

            except Device.DoesNotExist:
                return Response(
                    {"error": "Invalid device."}, status=status.HTTP_400_BAD_REQUEST
                )
            except Profile.DoesNotExist:
                return Response(
                    {"error": "Invalid profile."}, status=status.HTTP_400_BAD_REQUEST
                )
            except Exception as e:
                return Response(
                    {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="sync")
    def sync_inventory(self, request):
        serializer = InventorySyncSerializer(data=request.data)
        if serializer.is_valid():
            panorama_device_uuid = serializer.validated_data["panorama_device"]
            profile_uuid = serializer.validated_data["profile"]
            author_id = serializer.validated_data["author"]

            try:
                panorama_device = Device.objects.get(uuid=panorama_device_uuid)
                profile = Profile.objects.get(uuid=profile_uuid)

                print(f"Syncing inventory for {panorama_device.hostname}...")
                print(f"Profile: {profile.name}")

                # Trigger the Celery task and get the task ID
                task = execute_inventory_sync.delay(
                    panorama_device_uuid,
                    profile_uuid,
                    author_id,
                )

                return Response(
                    {"job_id": task.id},
                    status=status.HTTP_200_OK,
                )

            except Device.DoesNotExist:
                return Response(
                    {"error": "Invalid Panorama device"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            except Profile.DoesNotExist:
                return Response(
                    {"error": "Invalid profile"}, status=status.HTTP_400_BAD_REQUEST
                )
            except Exception as e:
                return Response(
                    {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DeviceTypeViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = DeviceType.objects.all()
    serializer_class = DeviceTypeSerializer

    def get_queryset(self):
        queryset = DeviceType.objects.all()
        device_type = self.kwargs.get("device_type", None)
        if device_type is not None:
            queryset = queryset.filter(device_type=device_type)
        return queryset


class JobViewSet(viewsets.ModelViewSet):
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
        response_data = {
            "task_id": instance.task_id,
            "author": instance.author.id,
            "created_at": instance.created_at.isoformat(),
            "updated_at": instance.updated_at.isoformat(),
            "job_type": instance.job_type,
            "json_data": instance.json_data if instance.json_data is not None else {},
        }
        return JsonResponse(response_data, status=200)


class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "uuid"

    def get_queryset(self):
        queryset = Profile.objects.all()
        name = self.request.query_params.get("name", None)
        if name is not None:
            queryset = queryset.filter(name=name)
        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


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
