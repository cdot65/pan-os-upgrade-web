# backend/panosupgradeweb/views.py

from packaging import version
import re

# django imports
from django.contrib.auth import get_user_model
from django.db.models import Value as V
from django.db.models import Case, When
from django.db.models.functions import Lower, Replace
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

# django rest framework imports
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.generics import RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

# directory object imports
from .models import (
    DeviceType,
    Device,
    Job,
    PanosVersion,
    Profile,
    Snapshot,
)
from .permissions import IsAuthorOrReadOnly
from .serializers import (
    DeviceSerializer,
    DeviceRefreshSerializer,
    DeviceTypeSerializer,
    DeviceUpgradeSerializer,
    InventorySyncSerializer,
    JobSerializer,
    JobLogEntrySerializer,
    PanosVersionSerializer,
    PanosVersionSyncSerializer,
    ProfileSerializer,
    SnapshotSerializer,
    UserSerializer,
)
from .tasks import (
    execute_inventory_sync,
    execute_refresh_device_task,
    execute_panos_version_sync,
    execute_upgrade_device_task,
)


class DeviceExistsView(APIView):
    """
    A view that returns the existence of an inventory item by name as a boolean.
    """

    @staticmethod
    def get(request):
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


class DeviceViewSet(viewsets.ModelViewSet):
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

                peer_device_uuid = request.data.get("peer_device_id")
                if peer_device_uuid:
                    try:
                        peer_device = Device.objects.get(uuid=peer_device_uuid)
                        serializer.validated_data["peer_device"] = peer_device
                    except Device.DoesNotExist:
                        return Response(
                            {"error": "Invalid peer device UUID"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except DeviceType.DoesNotExist:
                return Response(
                    {"error": "Invalid platform"}, status=status.HTTP_400_BAD_REQUEST
                )
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

                # Check for the "errored" status and return 422 if found
                if job.job_status == "errored":
                    return JsonResponse(
                        {"job_id": job_id, "status": job.job_status},
                        status=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    )
                else:
                    return JsonResponse({"job_id": job_id, "status": job.job_status})

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
                task = execute_refresh_device_task.delay(
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

    # Add a new action in the DeviceViewSet
    @action(detail=False, methods=["post"], url_path="upgrade")
    def upgrade_devices(self, request):
        serializer = DeviceUpgradeSerializer(data=request.data)
        if serializer.is_valid():
            devices = serializer.validated_data["devices"]
            dry_run = serializer.validated_data["dry_run"]
            profile_uuid = serializer.validated_data["profile"]
            author_id = serializer.validated_data["author"]
            target_version = serializer.validated_data["target_version"]

            try:
                profile = Profile.objects.get(uuid=profile_uuid)

                upgrade_jobs = []
                for device_uuid in devices:
                    try:
                        device = Device.objects.get(uuid=device_uuid)
                        print(f"Upgrading device {device.hostname}...")
                        print(f"Profile: {profile.name}")

                        task = execute_upgrade_device_task.delay(
                            author_id=author_id,
                            dry_run=dry_run,
                            device_uuid=str(device_uuid),
                            profile_uuid=str(profile_uuid),
                            target_version=target_version,
                        )
                        upgrade_jobs.append(
                            {"hostname": device.hostname, "job": task.id}
                        )
                    except Device.DoesNotExist:
                        print(f"Invalid device UUID: {device_uuid}")

                return Response(
                    {"upgrade_jobs": upgrade_jobs},
                    status=status.HTTP_200_OK,
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


class SnapshotViewSet(viewsets.ViewSet):
    @staticmethod
    def list(request):
        snapshots = Snapshot.objects.all()
        serializer = SnapshotSerializer(snapshots, many=True)
        return Response(serializer.data)

    @staticmethod
    def retrieve(request, pk=None):
        try:
            snapshot = Snapshot.objects.get(uuid=pk)
            serializer = SnapshotSerializer(snapshot)
            return Response(serializer.data)
        except Snapshot.DoesNotExist:
            return Response(
                {"error": "Snapshot not found."}, status=status.HTTP_404_NOT_FOUND
            )

    @staticmethod
    def retrieve_with_details(request, pk=None):
        try:
            snapshot = Snapshot.objects.get(uuid=pk)
            serializer = SnapshotSerializer(snapshot)
            return Response(serializer.data)
        except Snapshot.DoesNotExist:
            return Response(
                {"error": "Snapshot not found."}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["get"], url_path="job/(?P<job_id>[^/.]+)")
    def list_by_job(self, request, job_id=None):
        snapshots = Snapshot.objects.filter(job__task_id=job_id)
        serializer = SnapshotSerializer(snapshots, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="device/(?P<device_id>[^/.]+)")
    def list_by_device(self, request, device_id=None):
        snapshots = Snapshot.objects.filter(device__uuid=device_id)
        serializer = SnapshotSerializer(snapshots, many=True)
        return Response(serializer.data)


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

    def retrieve(self, request, pk=None, **kwargs):
        instance = self.get_object()
        response_data = {
            "task_id": instance.task_id,
            "author": instance.author.id,
            "created_at": instance.created_at.isoformat(),
            "updated_at": instance.updated_at.isoformat(),
            "job_type": instance.job_type,
            "job_status": instance.job_status
            if instance.job_status is not None
            else "pending",
            "current_step": instance.current_step
            if instance.current_step is not None
            else "errored",
            # Device fields
            "device_group": instance.device_group,
            "ha_enabled": instance.ha_enabled,
            "hostname": instance.hostname,
            "local_state": instance.local_state,
            "panorama_managed": instance.panorama_managed,
            "peer_device": instance.peer_device,
            "peer_state": instance.peer_state,
            "platform": instance.platform,
            "serial": instance.serial,
            "sw_version": instance.sw_version,
        }
        return JsonResponse(response_data, status=200)

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        job = self.get_queryset().get(pk=pk)
        log_entries = job.log_entries.all()
        serializer = JobLogEntrySerializer(log_entries, many=True)
        return Response(serializer.data)


class JobLogViewSet(viewsets.ViewSet):
    @staticmethod
    def list(request, job_id):
        job = get_object_or_404(Job, task_id=job_id)
        log_entries = job.log_entries.all()

        data = [
            {
                "timestamp": log.timestamp,
                "severity_level": log.severity_level,
                "message": log.message,
            }
            for log in log_entries
        ]
        return Response(data)


class PanosVersionViewSet(viewsets.ModelViewSet):
    queryset = PanosVersion.objects.all()
    serializer_class = PanosVersionSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["post"], url_path="sync")
    def sync_versions(self, request):
        serializer = PanosVersionSyncSerializer(data=request.data)
        if serializer.is_valid():
            device_uuid = serializer.validated_data["device"]
            profile_uuid = serializer.validated_data["profile"]
            author_id = serializer.validated_data["author"]

            try:
                device = Device.objects.get(uuid=device_uuid)
                profile = Profile.objects.get(uuid=profile_uuid)

                print(f"Syncing PAN-OS versions for device {device.hostname}...")
                print(f"Profile: {profile.name}")

                # Trigger the Celery task for PAN-OS version sync and get the task ID
                task = execute_panos_version_sync.delay(
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

    def get_queryset(self):
        queryset = PanosVersion.objects.all()
        version_param = self.request.query_params.get("version", None)

        if version_param is not None:
            queryset = queryset.filter(version=version_param)

        # Check if there are any entries in the queryset
        if not queryset.exists():
            return queryset  # Return empty queryset if no entries

        # Custom version parsing function
        def parse_panos_version(version_string):
            match = re.match(r"(\d+)\.(\d+)\.(\d+)(?:-h(\d+))?", version_string)
            if not match:
                return 0, 0, 0, 0  # Default for unparseable versions
            major, minor, patch, hotfix = match.groups()
            return int(major), int(minor), int(patch), int(hotfix or 0)

        # Custom sorting function
        def version_key(obj):
            return parse_panos_version(obj.version)

        # Sort the queryset
        sorted_queryset = sorted(queryset, key=version_key, reverse=True)

        # Create a Case-When expression for ordering
        case_order = Case(
            *[When(pk=obj.pk, then=pos) for pos, obj in enumerate(sorted_queryset)]
        )

        # Apply the custom ordering to the queryset
        return queryset.order_by(case_order)


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
