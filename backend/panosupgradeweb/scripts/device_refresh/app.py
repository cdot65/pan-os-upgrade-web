# backend/panosupgradeweb/scripts/device_refresh/app.py
from panos.firewall import Firewall
from panos.panorama import Panorama

from panosupgradeweb.scripts.logger import PanOsUpgradeLogger
from panosupgradeweb.scripts.utilities import (
    find_devicegroup_by_serial,
    flatten_xml_to_dict,
)

# import our Django models
from panosupgradeweb.models import (
    Device,
    Job,
    Profile,
)

from .refresh import DeviceRefresh

# Create an instance of the custom logger
job_logger = PanOsUpgradeLogger("pan-os-upgrade-device-refresh")


def main(
    author_id: int,
    device_uuid: str,
    job_id: str,
    profile_uuid: str,
) -> str:
    """
    Refresh the device information and update the corresponding Device object in the database.

    This function connects to a PAN device (firewall or Panorama) using the provided credentials,
    retrieves the system information, and updates the corresponding Device object in the database
    with the retrieved information. It also handles the case of a firewall device managed by Panorama.

    Args:
        author_id (int): The ID of the author performing the device refresh.
        device_uuid (str): The UUID of the device to be refreshed.
        job_id (str): The ID of the job associated with the device refresh.
        profile_uuid (str): The UUID of the profile containing the PAN device credentials.

    Returns:
        str: A JSON string containing the updated device information.

    Raises:
        Exception: If an error occurs while connecting to the PAN device or retrieving system information.

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Set JOB_ID global variable]
            B --> C[Log device refresh details]
            C --> D[Initialize device_data dictionary]
            D --> E[Retrieve Device, Profile, and Platform objects from the database]
            E --> F{Platform device type?}
            F -->|Firewall and not Panorama-managed| G[Connect to firewall directly]
            F -->|Firewall and Panorama-managed| H[Connect to firewall through Panorama]
            F -->|Panorama| I[Connect to Panorama]
            G --> J[Retrieve system information]
            H --> J
            I --> J
            J --> K[Store system information in device_data]
            K --> L{Platform device type and HA enabled?}
            L -->|Firewall and HA enabled| M[Retrieve HA state information]
            L -->|Firewall and HA disabled or Panorama| N[Set ha_enabled to False]
            M --> O[Parse HA state information and store in device_data]
            N --> P[Store additional device information in device_data]
            O --> P
            P --> Q[Update Device object in the database]
            Q --> R[Serialize device_data to JSON]
            R --> S[Return JSON string]
            S --> T[End]
        ```
    """

    # Create a new instance of the InventorySync class
    device_refresh = DeviceRefresh(job_id)

    device_refresh.logger.log_task(
        action="start",
        message=f"Running device refresh for device: {device_uuid}",
    )
    device_refresh.logger.log_task(
        action="info",
        message=f"Using profile: {profile_uuid}",
    )
    device_refresh.logger.log_task(
        action="info",
        message=f"Author ID: {author_id}",
    )

    # Initialize an empty dictionary to store the device data
    device_data = {}

    # Retrieve the PAN device, device type, profile, and job objects from the database
    device = Device.objects.get(uuid=device_uuid)
    profile = Profile.objects.get(uuid=profile_uuid)
    platform = device.platform
    job = Job.objects.get(task_id=job_id)

    # Build the PAN device object
    try:
        # If the device is not managed by Panorama, connect to it directly
        if platform.device_type == "Firewall" and not device.panorama_managed:
            # Connect to the firewall device using the retrieved credentials
            pan_device = Firewall(
                device.ipv4_address,
                profile.pan_username,
                profile.pan_password,
            )
            device_refresh.logger.log_task(
                action="success",
                message=f"Connected to firewall device {device.ipv4_address}",
            )

        elif platform.device_type == "Firewall" and device.panorama_managed:
            # If the device is managed by Panorama, connect to it through Panorama
            pan_device = Firewall(
                serial=device.serial,
            )
            panorama = Panorama(
                device.panorama_ipv4_address,
                profile.pan_username,
                profile.pan_password,
            )
            panorama.add(pan_device)

            # Retrieve device group
            device_group_mappings = DeviceRefresh.get_device_group_mapping(panorama)
            device_data["device_group"] = find_devicegroup_by_serial(
                device_group_mappings,
                device.serial,
            )
            device_refresh.logger.log_task(
                action="success",
                message=f"Connected to firewall through Panorama device {device.panorama_ipv4_address}",
            )

        else:
            # Connect to the Panorama device using the retrieved credentials
            pan_device = Panorama(
                device.ipv4_address,
                profile.pan_username,
                profile.pan_password,
            )
            device_refresh.logger.log_task(
                action="success",
                message=f"Connected to Panorama device {device.ipv4_address}",
            )

    except Exception as e:
        device_refresh.logger.log_task(
            action="error",
            message=f"Error while retrieving system information: {str(e)}",
        )
        job.job_status = "errored"
        job.save()
        return "errored"

    # Connect to the PAN device and retrieve the system information
    try:
        # Retrieve the system information from the firewall device
        device_refresh.logger.log_task(
            action="search",
            message=f"Retrieving system information from device {device.ipv4_address}",
        )
        system_info = pan_device.show_system_info()
        device_refresh.logger.log_task(
            action="success",
            message=f"Retrieved system information from device {device.ipv4_address}",
        )
        device_refresh.logger.log_task(
            action="debug",
            message=f"System Info: {system_info}",
        )

        # Store the relevant system information in the device_data dictionary
        device_data["hostname"] = system_info["system"]["hostname"]
        device_data["ipv4_address"] = system_info["system"]["ip-address"]
        device_data["ipv6_address"] = (
            system_info["system"]["ipv6-address"]
            if system_info["system"]["ipv6-address"] != "unknown"
            else None
        )
        device_data["serial"] = system_info["system"]["serial"]
        device_data["sw_version"] = system_info["system"]["sw-version"]
        device_data["app_version"] = (
            system_info["system"]["app-version"]
            if platform.device_type == "Firewall"
            else None
        )
        device_data["threat_version"] = (
            system_info["system"]["threat-version"]
            if platform.device_type == "Firewall"
            else None
        )
        device_data["uptime"] = system_info["system"]["uptime"]
        device_data["platform"] = platform.name

        # Retrieve the HA state information from the firewall device
        device_refresh.logger.log_task(
            action="search",
            message=f"Retrieving HA state information from device {device.ipv4_address}",
        )
        ha_info = pan_device.show_highavailability_state()

        # Parse the HA state information and store it in the device_data dictionary
        if platform.device_type == "Firewall" and ha_info[0] != "disabled":
            ha_details = flatten_xml_to_dict(element=ha_info[1])
            local_state = (
                ha_details.get("result", {})
                .get("group", {})
                .get("local-info", {})
                .get("state")
            )
            device_data["ha_enabled"] = True

            peer_ip = (
                ha_details.get("result", {})
                .get("group", {})
                .get("peer-info", {})
                .get("mgmt-ip", "")
                .split("/")[0]
            )

            try:
                peer_device = Device.objects.get(ipv4_address=peer_ip)
                peer_device_uuid = str(peer_device.uuid)
                peer_state = (
                    ha_details.get("result", {})
                    .get("group", {})
                    .get("peer-info", {})
                    .get("state")
                )

                device_data["peer_device_id"] = peer_device_uuid
                device_data["peer_ip"] = peer_ip
                device_data["peer_state"] = peer_state
                device_data["local_state"] = local_state
            except Device.DoesNotExist:
                device_refresh.logger.log_task(
                    action="warning",
                    message=f"Peer device with IP {peer_ip} not found. Skipping HA deployment.",
                )
        else:
            device_data["ha_enabled"] = False

        # Store additional device information in the device_data dictionary
        device_data["panorama_managed"] = device.panorama_managed
        device_data["panorama_appliance"] = (
            str(device.panorama_appliance.uuid) if device.panorama_managed else None
        )
        device_refresh.logger.log_task(
            action="debug",
            message=f"Device Data: {device_data}",
        )

        # Update the Device object using the device_data dictionary
        device_refresh.logger.log_task(
            action="save",
            message=f"Updating device {device_data['hostname']} in the database",
        )
        Device.objects.filter(uuid=device_uuid).update(
            app_version=device_data["app_version"],
            author_id=author_id,
            device_group=device_data.get("device_group"),
            ha_enabled=device_data["ha_enabled"],
            ipv4_address=device_data["ipv4_address"],
            ipv6_address=device_data["ipv6_address"],
            local_state=device_data.get("local_state"),
            panorama_managed=device_data["panorama_managed"],
            panorama_appliance_id=device_data.get("panorama_appliance"),
            peer_device_id=device_data.get("peer_device_id"),
            peer_ip=device_data.get("peer_ip"),
            peer_state=device_data.get("peer_state"),
            serial=device_data["serial"],
            sw_version=device_data["sw_version"],
            threat_version=device_data["threat_version"],
            uptime=device_data["uptime"],
        )
        device_refresh.logger.log_task(
            action="success",
            message=f"Device {device_data['hostname']} updated successfully",
        )

        # Serialize the device_data dictionary to JSON
        device_refresh.logger.log_task(
            action="report",
            message="Serializing device data to JSON",
        )
        return "completed"

    except Exception as e:
        device_refresh.logger.log_task(
            action="error",
            message=f"Error while retrieving system information: {str(e)}",
        )
        raise e
