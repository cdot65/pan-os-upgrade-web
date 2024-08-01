"""Tasks to execute with Invoke."""

# ---------------------------------------------------------------------------
# standard library
# ---------------------------------------------------------------------------
import inspect
import os
import subprocess
from typing import Literal

# ---------------------------------------------------------------------------
# third party
# ---------------------------------------------------------------------------
from invoke import task

# ---------------------------------------------------------------------------
# Python3.11 hack for invoke
# ---------------------------------------------------------------------------
if not hasattr(inspect, "getargspec"):
    inspect.getargspec = inspect.getfullargspec


# ---------------------------------------------------------------------------
# Determine Host operating system (to use Docker or Podman)
# ---------------------------------------------------------------------------
def get_container_runtime() -> Literal["podman", "docker"]:
    """Determine whether to use Docker or Podman based on the OS."""
    try:
        # Try to get OS information using /etc/os-release
        with open("/etc/os-release", "r") as f:
            os_release = f.read().lower()
        if any(
            operating_system in os_release
            for operating_system in ["rhel", "fedora", "centos"]
        ):
            return "podman"
    except FileNotFoundError:
        # If /etc/os-release doesn't exist, fallback to checking commands
        pass

    # Check if podman command exists
    if (
        subprocess.run(["which", "podman"], capture_output=True, text=True).returncode
        == 0
    ):
        return "podman"

    # Default to docker
    return "docker"


CONTAINER_RUNTIME = get_container_runtime()

# ---------------------------------------------------------------------------
# CONTAINER PARAMETERS
# ---------------------------------------------------------------------------
DOCKER_IMG_BACKEND = "ghcr.io/cdot65/pan-os-upgrade-web-backend"
DOCKER_TAG_BACKEND = "1.0.3-beta"

DOCKER_IMG_FRONTEND = "ghcr.io/cdot65/pan-os-upgrade-web-frontend"
DOCKER_TAG_FRONTEND = "1.0.3-beta"

DOCKER_IMG_WORKER = "ghcr.io/cdot65/pan-os-upgrade-web-worker"
DOCKER_TAG_WORKER = "1.0.3-beta"

# ---------------------------------------------------------------------------
# SYSTEM PARAMETERS
# ---------------------------------------------------------------------------
PWD = os.getcwd()


# ---------------------------------------------------------------------------
# CONTAINER BUILDS
# ---------------------------------------------------------------------------
@task()
def build(context):
    """Build our Container images."""
    build_containers = (
        f"{CONTAINER_RUNTIME} buildx bake -f docker-compose.build.yaml "
        "--set backend.platform=linux/amd64,linux/arm64 "
        "--set frontend.platform=linux/amd64,linux/arm64 "
        "--set worker.platform=linux/amd64,linux/arm64 --push"
    )
    context.run(build_containers)


# ---------------------------------------------------------------------------
# CONTAINER IMAGE PUBLISH
# ---------------------------------------------------------------------------
@task()
def publish(context):
    """Publish our Container images."""
    backend = f"{CONTAINER_RUNTIME} push {DOCKER_IMG_BACKEND}:{DOCKER_TAG_BACKEND}"
    worker = f"{CONTAINER_RUNTIME} push {DOCKER_IMG_WORKER}:{DOCKER_TAG_WORKER}"
    frontend = f"{CONTAINER_RUNTIME} push {DOCKER_IMG_FRONTEND}:{DOCKER_TAG_FRONTEND}"
    context.run(f"{backend} && {frontend} && {worker}")


@task()
def rebuild(context):
    """Rebuild our Container images."""
    stage_migrations = "touch backend/panosupgradeweb/migrations/fake.py"
    remove_migrations = "rm backend/panosupgradeweb/migrations/*.py"
    stop_containers = f"{CONTAINER_RUNTIME}-compose stop"
    remove_containers = f"{CONTAINER_RUNTIME}-compose rm -f"
    remove_volumes = f"{CONTAINER_RUNTIME} volume rm pan-os-upgrade-web_postgres_data"
    build_containers = f"{CONTAINER_RUNTIME}-compose build"
    start_containers = f"{CONTAINER_RUNTIME}-compose up -d"
    context.run(
        f"{stage_migrations} && "
        f"{remove_migrations} && "
        f"{stop_containers} && "
        f"{remove_containers} && "
        f"{remove_volumes} && "
        f"{build_containers} && "
        f"{start_containers}"
    )
