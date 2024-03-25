from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import (
    FirewallPlatformViewSet,
    PanoramaPlatformViewSet,
    InventoryExistsView,
    InventoryViewSet,
    JobViewSet,
    UserViewSet,
    UserProfileView,
)

router = SimpleRouter()
router.register(
    "inventory/platforms/firewall",
    FirewallPlatformViewSet,
    basename="firewall_platforms",
)
router.register(
    "inventory/platforms/panorama",
    PanoramaPlatformViewSet,
    basename="panorama_platforms",
)
router.register(
    "inventory",
    InventoryViewSet,
    basename="inventory",
)
router.register(
    "Job",
    JobViewSet,
    basename="Job",
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
