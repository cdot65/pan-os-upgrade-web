# LLM chat

## authentication

I have a Django backend with a custom user authentication and I'd like you to review my work and provide suggestions on improvements.

## backend/panosupgradeweb/permissions.py

```python
from rest_framework import permissions


class IsAuthorOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            # Allow read-only access for all users (authenticated and unauthenticated)
            return True
        # Allow write access only for authenticated users
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.author == request.user
```

## backend/panosupgradeweb/serializers.py

```python
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.conf import settings
import os
from .models import (
    Panorama,
    PanoramaPlatform,
    Prisma,
    Firewall,
    FirewallPlatform,
    Jobs,
    Message,
    Script,
)


class PanoramaPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = PanoramaPlatform
        fields = (
            "id",
            "name",
        )


class PanoramaSerializer(serializers.ModelSerializer):
    platform = serializers.CharField(source="platform.name", read_only=True)
    ipv6_address = serializers.IPAddressField(
        protocol="IPv6",
        allow_blank=True,
        required=False,
        allow_null=True,
    )

    def create(self, validated_data):
        return Panorama.objects.create(**validated_data)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

    class Meta:
        model = Panorama
        fields = (
            "api_key",
            "author",
            "created_at",
            "hostname",
            "ipv4_address",
            "ipv6_address",
            "notes",
            "platform",
            "uuid",
        )


class PrismaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Prisma
        fields = (
            "id",
            "tenant_name",
            "client_id",
            "client_secret",
            "tsg_id",
            "author",
            "created_at",
        )


class FirewallSerializer(serializers.ModelSerializer):
    platform = serializers.CharField(source="platform.name", read_only=True)
    ipv6_address = serializers.IPAddressField(
        protocol="IPv6",
        allow_blank=True,
        required=False,
        allow_null=True,
    )

    def create(self, validated_data):
        return Firewall.objects.create(**validated_data)

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

    class Meta:
        model = Firewall
        fields = (
            "api_key",
            "author",
            "created_at",
            "hostname",
            "ipv4_address",
            "ipv6_address",
            "notes",
            "platform",
            "uuid",
        )


class FirewallPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = FirewallPlatform
        fields = (
            "id",
            "name",
            "vendor",
        )


class JobsSerializer(serializers.ModelSerializer):
    task_id = serializers.CharField(read_only=True)  # Add the task_id field

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


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = "__all__"


class ScriptSerializer(serializers.ModelSerializer):
    content = serializers.CharField(write_only=True, required=False)
    file_content = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Script
        fields = "__all__"

    def get_file_content(self, obj):
        file_path = os.path.join(settings.SCRIPTS_BASE_PATH, obj.file.name)
        try:
            with open(file_path) as f:
                return f.read()
        except FileNotFoundError:
            print("FileNotFoundError for file path: ", file_path)
            return "File not found"

    def update(self, instance, validated_data):
        file_path = os.path.join(settings.SCRIPTS_BASE_PATH, instance.file.name)
        if "content" in validated_data:
            with open(file_path, "w") as f:
                f.write(validated_data.pop("content"))

        return super().update(instance, validated_data)
```

## backend/accounts/forms.py

```python
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomUser


class CustomUserCreationForm(UserCreationForm):
    class Meta(UserCreationForm):
        model = CustomUser
        fields = UserCreationForm.Meta.fields + ("name", "profile_image")

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.profile_image.name = f"{instance.profile_image.name.split('.')[0]}.png"
        if commit:
            instance.save()
        return instance


class CustomUserChangeForm(UserChangeForm):
    class Meta:
        model = CustomUser
        fields = UserChangeForm.Meta.fields
```

## backend/panosupgradeweb/urls.py

```python
from django.urls import path
from rest_framework.routers import SimpleRouter
from .views import (
    MessageViewSet,
    PanoramaViewSet,
    PanoramaPlatformViewSet,
    PanoramaExistsView,
    PrismaViewSet,
    FirewallPlatformViewSet,
    FirewallViewSet,
    FirewallExistsView,
    JobsViewSet,
    ScriptViewSet,
    UserViewSet,
    UserProfileView,
    execute_assurance_arp,
    execute_assurance_readiness,
    execute_assurance_snapshot,
    execute_get_system_info,
)

router = SimpleRouter()
router.register("ai/messages", MessageViewSet, basename="messages")
router.register("firewall/types", FirewallPlatformViewSet, basename="firewalltypes")
router.register("firewalls", FirewallViewSet, basename="firewalls")
router.register("panorama/types", PanoramaPlatformViewSet, basename="panorama_types")
router.register("panorama/inventory", PanoramaViewSet, basename="panorama_inventory")
router.register("prisma", PrismaViewSet, basename="prisma")
router.register("jobs", JobsViewSet, basename="jobs")
router.register("users", UserViewSet, basename="users")
router.register("scripts", ScriptViewSet, basename="scripts")

urlpatterns = router.urls

urlpatterns += [
    path(
        "user-profile/",
        UserProfileView.as_view(),
        name="user_profile",
    ),
    path(
        "firewall/exists",
        FirewallExistsView.as_view(),
        name="firewall_exists",
    ),
    path(
        "panorama/exists",
        PanoramaExistsView.as_view(),
        name="panorama_exists",
    ),
    path(
        "automation/assurance-arp",
        execute_assurance_arp,
        name="execute_assurance_arp",
    ),
    path(
        "automation/assurance-readiness",
        execute_assurance_readiness,
        name="execute_assurance_readiness",
    ),
    path(
        "automation/assurance-snapshot",
        execute_assurance_snapshot,
        name="execute_assurance_snapshot",
    ),
    path(
        "report/get-system-info",
        execute_get_system_info,
        name="execute_get_system_info",
    ),
]
```

## backend/accounts/admin.py

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .forms import CustomUserCreationForm, CustomUserChangeForm
from .models import CustomUser


class CustomUserAdmin(UserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = CustomUser
    list_display = ["email", "username", "name", "is_staff"]
    fieldsets = UserAdmin.fieldsets + ((None, {"fields": ("name", "profile_image")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (
        (None, {"fields": ("name", "profile_image")}),
    )


admin.site.register(CustomUser, CustomUserAdmin)
```

## backend/panosupgrade/views.py

```python
# django imports
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.db.models.functions import Lower, Replace
from django.db.models import Value as V

# django rest framework imports
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import RetrieveAPIView
from rest_framework.views import APIView


# directory object imports
from .models import (
    Panorama,
    PanoramaPlatform,
    Prisma,
    Firewall,
    FirewallPlatform,
    Jobs,
    Conversation,
    Message,
    Script,
)
from .permissions import IsAuthorOrReadOnly
from .serializers import (
    MessageSerializer,
    PanoramaSerializer,
    PanoramaPlatformSerializer,
    PrismaSerializer,
    FirewallSerializer,
    FirewallPlatformSerializer,
    JobsSerializer,
    ScriptSerializer,
    UserSerializer,
)

# Python scripts
from .tasks import (
    execute_get_system_info as get_system_info_task,
    execute_assurance_arp as assurance_arp_entry_task,
    execute_assurance_readiness as assurance_readiness_task,
    execute_assurance_snapshot as assurance_snapshot_task,
)


# ----------------------------------------------------------------------------
# Define ViewSets for API endpoints
# ----------------------------------------------------------------------------
class PanoramaViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = Panorama.objects.all()
    serializer_class = PanoramaSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                platform_name = request.data.get("platform")
                if platform_name:
                    platform = PanoramaPlatform.objects.get(name=platform_name)
                    serializer.validated_data["platform"] = platform
                serializer.save(author=self.request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PanoramaPlatformViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = PanoramaPlatform.objects.all()
    serializer_class = PanoramaPlatformSerializer


class PrismaViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = Prisma.objects.all()
    serializer_class = PrismaSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save(author=self.request.user)  # Change this line
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FirewallViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = Firewall.objects.all()
    serializer_class = FirewallSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                platform_name = request.data.get("platform")
                if platform_name:
                    platform = FirewallPlatform.objects.get(name=platform_name)
                    serializer.validated_data["platform"] = platform
                serializer.save(author=self.request.user)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class FirewallPlatformViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = FirewallPlatform.objects.all()
    serializer_class = FirewallPlatformSerializer


class JobsViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    queryset = Jobs.objects.all()
    serializer_class = JobsSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save(author=self.request.user)  # Change this line
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


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer

    def retrieve(self, request, pk=None, format=None):
        conversation = Conversation.objects.get(pk=pk)
        message = conversation.messages.order_by("-index").first()
        serializer = self.get_serializer(message)
        return Response(serializer.data)


class ScriptViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthorOrReadOnly,)
    serializer_class = ScriptSerializer

    def get_queryset(self):
        queryset = Script.objects.all()

        name = self.request.query_params.get("name", None)
        if name is not None:
            queryset = queryset.filter(name=name)

        return queryset


class FirewallExistsView(APIView):
    """
    A view that returns the existence of a firewall item by name as a boolean.
    """

    def get(self, request, format=None):
        raw_firewall_hostname = request.GET.get("hostname", None)
        if raw_firewall_hostname is not None:
            formatted_firewall_hostname = (
                raw_firewall_hostname.lower().replace(" ", "_").replace("-", "_")
            )
            exists = (
                Firewall.objects.annotate(
                    formatted_hostname=Replace(
                        Replace(Lower("hostname"), V(" "), V("_")), V("-"), V("_")
                    )
                )
                .filter(formatted_hostname=formatted_firewall_hostname)
                .exists()
            )
            return Response(
                {"exists": exists, "formatted_value": formatted_firewall_hostname}
            )
        else:
            return Response(
                {"error": "No firewall hostname provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class PanoramaExistsView(APIView):
    """
    A view that returns the existence of a panorama item by name as a boolean.
    """

    def get(self, request, format=None):
        raw_panorama_hostname = request.GET.get("hostname", None)
        if raw_panorama_hostname is not None:
            formatted_panorama_hostname = (
                raw_panorama_hostname.lower().replace(" ", "_").replace("-", "_")
            )
            exists = (
                Panorama.objects.annotate(
                    formatted_hostname=Replace(
                        Replace(Lower("hostname"), V(" "), V("_")), V("-"), V("_")
                    )
                )
                .filter(formatted_hostname=formatted_panorama_hostname)
                .exists()
            )
            return Response(
                {"exists": exists, "formatted_value": formatted_panorama_hostname}
            )
        else:
            return Response(
                {"error": "No panorama hostname provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ----------------------------------------------------------------------------
# Define API endpoints for executing tasks
# ----------------------------------------------------------------------------


# Get System Info from Panorama
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def execute_get_system_info(request):
    pan_url = request.data.get("pan_url")
    api_key = request.data.get("api_key")
    author_id = request.user.id

    task = get_system_info_task.delay(pan_url, api_key, author_id)

    task_id = task.id

    return Response(
        {"message": "Task has been executed", "task_id": task_id},
        status=status.HTTP_200_OK,
    )


# Assurance ARP Execution
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def execute_assurance_arp(request):
    # Use hostname from request to get api_key and IPv4 address
    hostname = request.data.get("hostname")
    try:
        firewall_instance = Firewall.objects.get(hostname=hostname)
        api_key = firewall_instance.api_key
        hostname = firewall_instance.ipv4_address
    except Firewall.DoesNotExist:
        return Response(
            {"message": "Firewall with the given hostname does not exist."},
            status=status.HTTP_404_NOT_FOUND,
        )
    operation_type = "readiness_check"
    action = "arp_entry_exist"
    config = request.data.get("config")
    author_id = request.user.id

    # Execute task
    task = assurance_arp_entry_task.delay(
        hostname,
        api_key,
        operation_type,
        action,
        config,
        author_id,
    )

    task_id = task.id

    return Response(
        {"message": "Task has been executed", "task_id": task_id},
        status=status.HTTP_200_OK,
    )


# Assurance Readiness
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def execute_assurance_readiness(request):
    # Use hostname from request to get api_key and IPv4 address
    hostname = request.data.get("hostname")
    try:
        firewall_instance = Firewall.objects.get(hostname=hostname)
        api_key = firewall_instance.api_key
        hostname = firewall_instance.ipv4_address
    except Firewall.DoesNotExist:
        return Response(
            {"message": "Firewall with the given hostname does not exist."},
            status=status.HTTP_404_NOT_FOUND,
        )
    operation_type = "readiness_check"
    config = request.data.get("config")
    author_id = request.user.id

    # Fetch the 'types' from the request payload
    types = request.data.get("types", {})

    # Check if the "all" key is true
    if types.get("all", False):
        # If "all" is true, include all keys except "all" itself
        action = ",".join([key for key in types.keys() if key != "all"])
    else:
        # If "all" is not true, filter out keys with true values
        action = ",".join([key for key, value in types.items() if value])

    # Execute task
    task = assurance_readiness_task.delay(
        hostname,
        api_key,
        operation_type,
        action,
        config,
        author_id,
    )

    task_id = task.id

    return Response(
        {"message": "Task has been executed", "task_id": task_id},
        status=status.HTTP_200_OK,
    )


# Assurance Snapshot
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def execute_assurance_snapshot(request):
    # Use hostname from request to get api_key and IPv4 address
    hostname = request.data.get("hostname")
    try:
        firewall_instance = Firewall.objects.get(hostname=hostname)
        api_key = firewall_instance.api_key
        hostname = firewall_instance.ipv4_address
    except Firewall.DoesNotExist:
        return Response(
            {"message": "Firewall with the given hostname does not exist."},
            status=status.HTTP_404_NOT_FOUND,
        )
    operation_type = "state_snapshot"
    # `config` is not within the body of this operation but is included for consistency
    config = request.data.get("config")
    author_id = request.user.id

    # Fetch the 'types' from the request payload
    types = request.data.get("types", {})

    # Check if the "all" key is true
    if types.get("all", False):
        # If "all" is true, include all keys except "all" itself
        action = ",".join([key for key in types.keys() if key != "all"])
    else:
        # If "all" is not true, filter out keys with true values
        action = ",".join([key for key, value in types.items() if value])

    # Execute task
    task = assurance_snapshot_task.delay(
        hostname,
        api_key,
        operation_type,
        action,
        config,
        author_id,
    )

    task_id = task.id

    return Response(
        {"message": "Task has been executed", "task_id": task_id},
        status=status.HTTP_200_OK,
    )
```

## backend/accounts/apps.py

```python
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"
```

## backend/django_project/urls.py

```python
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include("panosupgradeweb.urls")),
    # http://localhost:8000/api-authlogin
    path("api-auth", include("rest_framework.urls")),
    path("api/v1/dj-rest-auth/", include("dj_rest_auth.urls")),
    path(
        "api/v1/dj-rest-auth/registration/", include("dj_rest_auth.registration.urls")
    ),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/redoc",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    path(
        "api/schema/swagger",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger",
    ),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

## backend/django_project/settings.py

```python
from pathlib import Path
from environs import Env

env = Env()
env.read_env()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.0/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env.str("DJANGO_SECRET_KEY")

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env.bool("DJANGO_DEBUG", default=False)

ALLOWED_HOSTS = ["*", "localhost", "127.0.0.1"]


# Application definition

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "whitenoise.runserver_nostatic",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    # third party
    "rest_framework",
    "corsheaders",
    "rest_framework.authtoken",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "drf_spectacular",
    # local
    "accounts.apps.AccountsConfig",
    "panosupgradeweb.apps.PanOsUpgradeWebConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# Media settings
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


CORS_ORIGIN_ALLOW_ALL = True


# CORS_ORIGIN_WHITELIST = [
#     "http://localhost:3000",
#     "http://frontend:4200",
#     "http://frontend:8080",
#     "http://localhost:4200",
#     "http://localhost:8080",
#     "http://localhost:8000",
# ]

CSRF_TRUSTED_ORIGINS = [
    "http://*",
    "http://localhost:4200",
    "http://localhost:8080",
    "http://localhost:8000",
]

CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "MEDIA_URL",
    "MEDIA_ROOT",
]

CORS_ALLOW_CREDENTIALS = True


ROOT_URLCONF = "django_project.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "django_project.wsgi.application"


# Database
# https://docs.djangoproject.com/en/4.0/ref/settings/#databases

# DATABASES = {"default": env.dj_db_url("DATABASE_URL", default="sqlite:///db.sqlite3")}

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env.str("POSTGRES_DB"),
        "USER": env.str("POSTGRES_USER"),
        "PASSWORD": env.str("POSTGRES_PASSWORD"),
        "HOST": env.str("POSTGRES_HOST"),
        "PORT": env.int("POSTGRES_PORT"),
    }
}

# Password validation
# https://docs.djangoproject.com/en/4.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

SITE_ID = 1


# Internationalization
# https://docs.djangoproject.com/en/4.0/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.0/howto/static-files/

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"


# Default primary key field type
# https://docs.djangoproject.com/en/4.0/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DRF settings
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "panosupgradeweb",
    "DESCRIPTION": "Sync configuration data between Panorama and Prisma Access",
    "VERSION": "1.0.0",
}

# custom auth model
AUTH_USER_MODEL = "accounts.CustomUser"

# celery broker
CELERY_BROKER_URL = "redis://redis:6379/0"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{module} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
        },
    },
}

SCRIPTS_BASE_PATH = "/code/panosupgradeweb/scripts/"
```

## backend/accounts/models.py

```python
from django.contrib.auth.models import AbstractUser
from django.db import models
from PIL import Image, ImageDraw
import io
from django.core.files.uploadedfile import InMemoryUploadedFile


class CustomUser(AbstractUser):
    name = models.CharField(max_length=255, blank=True, null=True)
    profile_image = models.ImageField(
        upload_to="profile_images/", blank=True, null=True
    )

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.profile_image:
            img = Image.open(self.profile_image.path)

            # Resize the image
            img = img.resize((128, 128), Image.ANTIALIAS)

            # Convert image to a circle
            width, height = img.size
            radius = min(width, height) // 2
            circle_image = Image.new("L", (width, height), 0)
            draw = ImageDraw.Draw(circle_image)
            draw.ellipse(
                (
                    width // 2 - radius,
                    height // 2 - radius,
                    width // 2 + radius,
                    height // 2 + radius,
                ),
                fill=255,
            )
            img.putalpha(circle_image)

            # Save the modified image
            output = io.BytesIO()
            img.save(output, format="PNG")
            output.seek(0)

            self.profile_image = InMemoryUploadedFile(
                output,
                "ImageField",
                f"{self.profile_image.name.split('.')[0]}.png",
                "image/png",
                len(output.getvalue()),
                None,
            )
            super().save(*args, **kwargs)
```
