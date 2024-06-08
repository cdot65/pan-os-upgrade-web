# backend/panosupgradeweb/scripts/__init__.py

from .device_refresh.app import run_device_refresh
from .inventory_sync.app import main as run_inventory_sync
from .upgrade.app import main as run_panos_upgrade
