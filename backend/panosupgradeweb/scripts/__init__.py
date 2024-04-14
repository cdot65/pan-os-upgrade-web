# backend/panosupgradeweb/scripts/__init__.py

from .inventory_sync.app import run_inventory_sync
from .device_refresh.app import run_device_refresh
from .upgrade.app import run_panos_upgrade
