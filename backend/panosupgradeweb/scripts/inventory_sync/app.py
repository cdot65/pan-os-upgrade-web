# backend/panosupgradeweb/scripts/inventory_sync/app.py
from panos.firewall import Firewall
from panos.panorama import Panorama
from panosupgradeweb.scripts.logger import PanOsUpgradeLogger
from pan_os_upgrade.components.utilities import flatten_xml_to_dict

# import our Django models
from panosupgradeweb.models import (
    Device,
    DeviceType,
    Profile,
)
from django.core.exceptions import ObjectDoesNotExist

from .inventory import InventorySync

# Create an instance of the custom logger
job_logger = PanOsUpgradeLogger("pan-os-upgrade-inventory-sync")


# noinspection PyTypeChecker
def main(
    author_id: int,
    job_id: str,
    panorama_device_uuid: str,
    profile_uuid: str,
) -> str:
    """
    Perform an inventory sync for a Panorama device.

    This function retrieves the connected devices from a Panorama device and creates or updates
    the corresponding Device objects in the database. It also handles the assignment of peer devices
    for HA deployments.

    Args:
        author_id (int): The ID of the author performing the inventory sync.
        job_id (str): The unique identifier of the inventory sync job.
        panorama_device_uuid (str): The UUID of the Panorama device.
        profile_uuid (str): The UUID of the profile associated with the Panorama device.

    Returns:
        str: The string representation of the status.

    Raises:
        Exception: If an error occurs during the inventory sync process.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Log inventory sync details]
            B --> C[Retrieve Panorama device and profile from database]
            C --> D[Connect to Panorama device]
            D --> E[Retrieve system info and device group mappings]
            E --> F[Retrieve connected devices]
            F --> G[Create/update Device objects]
            G --> H[Update peer device information for HA deployments]
            H --> I[Return status message]
            I --> J[Log any errors and raise exception]
            J --> K[End]
        ```
    """

    # Create a new instance of the InventorySync class
    inventory_sync = InventorySync(job_id)

    inventory_sync.logger.log_task(
        action="start",
        message=f"Running inventory sync for Panorama device: {panorama_device_uuid}",
    )

    inventory_sync.logger.log_task(
        action="info",
        message=f"Using profile: {profile_uuid}",
    )
    inventory_sync.logger.log_task(
        action="info",
        message=f"Author ID: {author_id}",
    )

    inventory_sync.logger.log_task(
        action="start",
        message="Starting inventory sync",
    )

    # Create placeholders for object created within try/except clauses
    device_group_mappings = None
    missing_peer_devices = []
    pan = None
    panorama_device = None
    panorama_hostname = ""
    result_dict = {}

    try:
        # Retrieve the Panorama device and profile objects from the database
        panorama_device = Device.objects.get(uuid=panorama_device_uuid)
        inventory_sync.logger.log_task(
            action="search",
            message=f"Retrieved Panorama device: {panorama_device.hostname}",
        )

        profile = Profile.objects.get(uuid=profile_uuid)
        inventory_sync.logger.log_task(
            action="search",
            message=f"Retrieved profile: {profile.name}",
        )

        # Access the authentication data directly from the profile fields
        pan_username = profile.pan_username
        pan_password = profile.pan_password

        # Connect to the Panorama device using the retrieved credentials
        pan = Panorama(
            (
                panorama_device.ipv4_address
                if panorama_device.ipv4_address
                else panorama_device.ipv6_address
            ),
            pan_username,
            pan_password,
        )
        inventory_sync.logger.log_task(
            action="info",
            message=f"Connected to Panorama device: {panorama_device.ipv4_address}",
        )

        # Retrieve the system information from the Panorama device
        system_info = pan.show_system_info()
        panorama_hostname = system_info["system"]["hostname"]
        inventory_sync.logger.log_task(
            action="search",
            message=f"Connected to Panorama device: {panorama_hostname}",
        )

        # Retrieve the device group mappings from the Panorama device
        device_group_mappings = InventorySync.get_device_group_mapping(pan=pan)
        inventory_sync.logger.log_task(
            action="search",
            message=f"Retrieved device group mappings {device_group_mappings}",
        )

        # Retrieve the connected devices
        connected_devices = pan.op("show devices connected")
        result_dict = flatten_xml_to_dict(element=connected_devices)
        inventory_sync.logger.log_task(
            action="search",
            message=f"Retrieved connected devices {result_dict['result']['devices']}",
        )

    except Exception as e:
        inventory_sync.logger.log_task(
            action="error",
            message=f"Error during 'show devices connected' command: {str(e)}",
        )

    try:
        inventory_sync.logger.log_task(
            action="start",
            message="Starting device creation/update",
        )
        # Step 1: Create or update Device objects based on the retrieved devices
        for device in result_dict["result"]["devices"]["entry"]:
            platform_name = device["model"]

            # Retrieve the DeviceType object based on the platform_name
            try:
                platform = DeviceType.objects.get(name=platform_name)
            except ObjectDoesNotExist:
                # Handle the case when the platform doesn't exist
                inventory_sync.logger.log_task(
                    action="skipped",
                    message=f"Platform '{platform_name}' not found. Skipping device: {device['@name']}",
                )
                continue
            inventory_sync.logger.log_task(
                action="search",
                message=f"Retrieved platform: {platform.name}",
            )

            # Build connection to firewall device through Panorama object
            firewall = Firewall(serial=device["serial"])
            pan.add(firewall)

            # Retrieve the system information from the firewall device
            info = firewall.show_system_info()
            inventory_sync.logger.log_task(
                action="search",
                message=f"Retrieved system info for device: {info['system']['hostname']}",
            )
            inventory_sync.logger.log_task(
                action="debug",
                message=f"System info: {info}",
            )

            # Retrieve the HA state information from the firewall device
            ha_info = firewall.show_highavailability_state()
            inventory_sync.logger.log_task(
                action="search",
                message=f"Retrieved HA state for device: {info['system']['hostname']}",
            )

            ha_enabled = ha_info[0] != "disabled"

            peer_device_uuid = None
            peer_ip = None
            peer_state = None
            local_state = None

            if ha_enabled:
                ha_details = flatten_xml_to_dict(element=ha_info[1])
                peer_ip = ha_details["result"]["group"]["peer-info"]["mgmt-ip"].split(
                    "/"
                )[0]
                local_state = ha_details["result"]["group"]["local-info"]["state"]

                try:
                    peer_device = Device.objects.get(ipv4_address=peer_ip)
                    peer_device_uuid = str(peer_device.uuid)
                    peer_state = ha_details["result"]["group"]["peer-info"]["state"]
                except ObjectDoesNotExist:
                    # When the peer device doesn't yet exist, we will revisit after creation.
                    missing_peer_devices.append(firewall)

                    inventory_sync.logger.log_task(
                        action="skipped",
                        message=f"Peer device with IP {peer_ip} not found. Skipping HA deployment.",
                    )

            panorama_appliance_uuid = None
            if panorama_hostname:
                try:
                    panorama_appliance = Device.objects.get(hostname=panorama_hostname)
                    panorama_appliance_uuid = str(panorama_appliance.uuid)
                    inventory_sync.logger.log_task(
                        action="search",
                        message=f"Retrieved Panorama appliance: {panorama_appliance.hostname}",
                    )
                except ObjectDoesNotExist:
                    inventory_sync.logger.log_task(
                        action="skipped",
                        message=f"Panorama appliance '{panorama_hostname}' not found. Skipping assignment.",
                    )

            # Create or update the Device object
            Device.objects.update_or_create(
                hostname=info["system"]["hostname"],
                defaults={
                    "app_version": info["system"]["app-version"],
                    "author_id": author_id,
                    "device_group": InventorySync.find_devicegroup_by_serial(
                        device_group_mappings,
                        device["serial"],
                    ),
                    "ha_enabled": ha_enabled,
                    "ipv4_address": (
                        info["system"]["ip-address"]
                        if info["system"]["ip-address"] != "unknown"
                        else None
                    ),
                    "ipv6_address": (
                        info["system"]["ipv6-address"]
                        if info["system"]["ipv6-address"] != "unknown"
                        else None
                    ),
                    "local_state": local_state,
                    "notes": None,
                    "platform": platform,
                    "panorama_appliance_id": panorama_appliance_uuid,
                    "panorama_managed": True,
                    "panorama_ipv4_address": panorama_device.ipv4_address,
                    "panorama_ipv6_address": panorama_device.ipv6_address,
                    "peer_device_id": peer_device_uuid,
                    "peer_ip": peer_ip,
                    "peer_state": peer_state,
                    "serial": info["system"]["serial"],
                    "sw_version": info["system"]["sw-version"],
                    "threat_version": info["system"]["threat-version"],
                    "uptime": info["system"]["uptime"],
                },
            )
            inventory_sync.logger.log_task(
                action="save",
                message=f"Created/updated device: {info['system']['hostname']}",
            )

    except Exception as e:
        inventory_sync.logger.log_task(
            action="error",
            message=f"Error during initial pass of inventory sync: {str(e)}",
        )

    try:
        # Step 2: Revisit the missing peer devices and update the peer_device_id
        inventory_sync.logger.log_task(
            action="start",
            message="Starting missing peer device update",
        )
        for firewall in missing_peer_devices:
            ha_info = firewall.show_highavailability_state()
            ha_details = flatten_xml_to_dict(element=ha_info[1])
            peer_ip = ha_details["result"]["group"]["peer-info"]["mgmt-ip"].split("/")[
                0
            ]

            try:
                peer_device = Device.objects.get(ipv4_address=peer_ip)
                peer_device_uuid = str(peer_device.uuid)
                peer_state = ha_details["result"]["group"]["peer-info"]["state"]
                inventory_sync.logger.log_task(
                    action="search",
                    message=f"Retrieved peer device: {peer_device.hostname}",
                )
            except ObjectDoesNotExist:
                inventory_sync.logger.log_task(
                    action="error",
                    message=f"Peer device with IP {peer_ip} still not found. Skipping HA deployment.",
                )
                continue

            Device.objects.filter(serial=firewall.serial).update(
                peer_device_id=peer_device_uuid, peer_ip=peer_ip, peer_state=peer_state
            )
            inventory_sync.logger.log_task(
                action="save",
                message=f"Updated peer device for: {firewall.serial}",
            )
            return "completed"

    except Exception as e:
        inventory_sync.logger.log_task(
            action="error",
            message=f"Error during second pass of inventory sync: {str(e)}",
        )
