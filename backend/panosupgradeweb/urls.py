# backend/panosupgradeweb/urls.py

from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import (
    DeviceExistsView,
    DeviceTypeViewSet,
    DeviceViewSet,
    JobViewSet,
    ProfileViewSet,
    UserViewSet,
    UserProfileView,
    SnapshotViewSet,
)

router = SimpleRouter()
router.register(
    "inventory",
    DeviceViewSet,
    basename="inventory",
)

router.register(
    "jobs",
    JobViewSet,
    basename="jobs",
)

router.register(
    "profiles",
    ProfileViewSet,
    basename="profiles",
)

router.register(
    "users",
    UserViewSet,
    basename="users",
)

router.register(
    "snapshots",
    SnapshotViewSet,
    basename="snapshots",
)

urlpatterns = [
    path(
        "inventory/platforms/",
        DeviceTypeViewSet.as_view({"get": "list"}),
        name="inventory-platforms-list",
    ),
    path(
        "inventory/refresh/",
        DeviceViewSet.as_view({"post": "refresh_device"}),
        name="inventory-refresh",
    ),
    path(
        "inventory/job-status/",
        DeviceViewSet.as_view({"get": "get_job_status"}),
        name="job-status",
    ),
    path(
        "inventory/sync/",
        DeviceViewSet.as_view({"post": "sync_inventory"}),
        name="inventory-sync",
    ),
    path(
        "inventory/upgrade/",
        DeviceViewSet.as_view({"post": "upgrade_devices"}),
        name="inventory-upgrade",
    ),
    path(
        "inventory/platforms/<int:pk>/",
        DeviceTypeViewSet.as_view({"get": "retrieve"}),
        name="inventory-platforms-detail",
    ),
    path(
        "inventory/platforms/firewall/",
        DeviceTypeViewSet.as_view({"get": "list"}),
        {"device_type": "Firewall"},
        name="firewall-platforms",
    ),
    path(
        "inventory/platforms/panorama/",
        DeviceTypeViewSet.as_view({"get": "list"}),
        {"device_type": "Panorama"},
        name="panorama-platforms",
    ),
    path(
        "user-profile/",
        UserProfileView.as_view(),
        name="user_profile",
    ),
    path(
        "inventory/exists",
        DeviceExistsView.as_view(),
        name="inventory_exists",
    ),
]

urlpatterns += router.urls
