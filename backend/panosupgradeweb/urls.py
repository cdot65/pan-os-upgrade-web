from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import (
    InventoryExistsView,
    InventoryPlatformViewSet,
    InventoryViewSet,
    JobViewSet,
    ProfileViewSet,
    UserViewSet,
    UserProfileView,
)

router = SimpleRouter()
router.register(
    "inventory",
    InventoryViewSet,
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

urlpatterns = [
    path(
        "inventory/platforms/",
        InventoryPlatformViewSet.as_view({"get": "list"}),
        name="inventory-platforms-list",
    ),
    path(
        "inventory/sync/",
        InventoryViewSet.as_view({"post": "sync_inventory"}),
        name="inventory-sync",
    ),
    path(
        "inventory/platforms/<int:pk>/",
        InventoryPlatformViewSet.as_view({"get": "retrieve"}),
        name="inventory-platforms-detail",
    ),
    path(
        "inventory/platforms/firewall/",
        InventoryPlatformViewSet.as_view({"get": "list"}),
        {"device_type": "Firewall"},
        name="firewall-platforms",
    ),
    path(
        "inventory/platforms/panorama/",
        InventoryPlatformViewSet.as_view({"get": "list"}),
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
        InventoryExistsView.as_view(),
        name="inventory_exists",
    ),
]

urlpatterns += router.urls
