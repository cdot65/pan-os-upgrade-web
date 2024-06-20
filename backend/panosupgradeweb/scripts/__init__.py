# backend/panosupgradeweb/scripts/__init__.py

from .device_refresh.app import main as run_device_refresh
from .inventory_sync.app import main as run_inventory_sync
from .panos_version_sync.app import main as run_panos_version_sync
from .upgrade_device.app import main as run_upgrade_device
