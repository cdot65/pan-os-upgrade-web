from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import (
    PanoramaPlatformViewSet,
    FirewallPlatformViewSet,
    InventoryExistsView,
    InventoryViewSet,
    JobsViewSet,
    UserViewSet,
    UserProfileView,
)

router = SimpleRouter()
router.register(
    "inventory/types/firewall",
    FirewallPlatformViewSet,
    basename="firewall_types",
)
router.register(
    "inventory/types/panorama",
    PanoramaPlatformViewSet,
    basename="panorama_types",
)
router.register(
    "inventory",
    InventoryViewSet,
    basename="inventory",
)
router.register(
    "jobs",
    JobsViewSet,
    basename="jobs",
)
router.register(
    "users",
    UserViewSet,
    basename="users",
)

urlpatterns = router.urls

urlpatterns += [
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
