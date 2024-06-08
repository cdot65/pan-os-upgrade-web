"""Tasks to execute with Invoke."""

# ---------------------------------------------------------------------------
# Python3.11 hack for invoke
# ---------------------------------------------------------------------------
import inspect

if not hasattr(inspect, "getargspec"):
    inspect.getargspec = inspect.getfullargspec

import os
from invoke import task

# ---------------------------------------------------------------------------
# DOCKER PARAMETERS
# ---------------------------------------------------------------------------
DOCKER_IMG_BACKEND = "ghcr.io/cdot65/pan-os-upgrade-web-backend"
DOCKER_TAG_BACKEND = "0.0.1"

DOCKER_IMG_FRONTEND = "ghcr.io/cdot65/pan-os-upgrade-web-frontend"
DOCKER_TAG_FRONTEND = "0.0.1"

DOCKER_IMG_WORKER = "ghcr.io/cdot65/pan-os-upgrade-web-worker"
DOCKER_TAG_WORKER = "0.0.1"


# ---------------------------------------------------------------------------
# SYSTEM PARAMETERS
# ---------------------------------------------------------------------------
PWD = os.getcwd()


# ---------------------------------------------------------------------------
# DOCKER CONTAINER BUILDS
# ---------------------------------------------------------------------------
@task()
def build(context):
    """Build our Docker images."""
    backend = f"docker build -t {DOCKER_IMG_BACKEND}:{DOCKER_TAG_BACKEND} ./backend"
    worker = f"docker tag {DOCKER_IMG_BACKEND}:{DOCKER_TAG_BACKEND} {DOCKER_IMG_WORKER}:{DOCKER_TAG_WORKER}"
    frontend = f"docker build -t {DOCKER_IMG_FRONTEND}:{DOCKER_TAG_FRONTEND} ./frontend"
    context.run(
        f"{backend} && {frontend} && {worker}",
    )


# ---------------------------------------------------------------------------
# DOCKER CONTAINER IMAGE PUBLISH
# ---------------------------------------------------------------------------
@task()
def publish(context):
    """Build our Docker images."""
    backend = f"docker push {DOCKER_IMG_BACKEND}:{DOCKER_TAG_BACKEND}"
    worker = f"docker push {DOCKER_IMG_WORKER}:{DOCKER_TAG_WORKER}"
    frontend = f"docker push {DOCKER_IMG_FRONTEND}:{DOCKER_TAG_FRONTEND}"
    context.run(
        f"{backend} && {frontend} && {worker}",
    )


@task()
def rebuild(context):
    """Rebuild our Docker images."""
    stage_migrations = "touch backend/panosupgradeweb/migrations/fake.py"
    remove_migrations = "rm backend/panosupgradeweb/migrations/*.py"
    stop_containers = "docker-compose stop"
    remove_containers = "docker-compose rm -f"
    remove_volumes = "docker volume rm pan-os-upgrade-web_postgres_data"
    build_containers = "docker-compose build"
    start_containers = "docker-compose up -d"
    context.run(
        f"{stage_migrations} && "
        f"{remove_migrations} && "
        f"{stop_containers} && "
        f"{remove_containers} && "
        f"{remove_volumes} && "
        f"{build_containers} && "
        f"{start_containers}",
    )
