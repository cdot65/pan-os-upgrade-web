from typing import Dict, List, Optional

# Palo Alto Networks SDK imports
from panos.panorama import Panorama

# pan-os-upgrade-web imports
from panosupgradeweb.scripts.logger import PanOsUpgradeLogger


class InventorySync:
    """
    A class to handle the inventory sync process.

    This class provides methods to perform various tasks related to syncing
    inventory details from PAN-OS devices connected to Panorama appliances.
    Inventory is created / updated within the Django database.
    """

    def __init__(
            self,
            job_id: str,
    ):
        self.job_id = job_id
        self.logger = PanOsUpgradeLogger("pan-os-upgrade-inventory-sync")
        self.logger.set_job_id(job_id)
        self.upgrade_devices = []

    @staticmethod
    def get_device_group_mapping(pan: Panorama) -> List[Dict]:
        """
        Retrieve the device group mappings from a Panorama instance.

        This function retrieves the device group mappings by querying the Panorama instance
        using the 'show devicegroups' operational command. It parses the XML response and
        constructs a list of dictionaries representing the device group mappings.

        Each device group mapping dictionary contains the following keys:
        - '@name': The name of the device group.
        - 'devices' (optional): A list of devices associated with the device group.

        Each device dictionary within the 'devices' list contains the following keys:
        - '@name': The name of the device.
        - 'serial': The serial number of the device.
        - 'connected': The connection status of the device.

        Args:
            pan (Panorama): The Panorama instance to retrieve the device group mappings from.

        Returns:
            List[Dict]: A list of dictionaries representing the device group mappings.

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B[Query Panorama for device groups]
                B --> C[Iterate over device group entries]
                C --> D{Device group has devices?}
                D -->|Yes| E[Iterate over device entries]
                E --> F[Create device dictionary]
                F --> G[Append device dictionary to devices list]
                G --> H[Add devices list to device group dictionary]
                D -->|No| H
                H --> I[Append device group dictionary to mappings list]
                I --> J{More device group entries?}
                J -->|Yes| C
                J -->|No| K[Return device group mappings]
            ```

        Example:
            ```python
            pan = Panorama(hostname="panorama.example.com", api_key="abc123")
            device_group_mappings = get_device_group_mapping(pan)
            print(device_group_mappings)
            ```

            Output:
            ```
            [
                {
                    '@name': 'Device-Group-1',
                    'devices': [
                        {
                            '@name': 'firewall-1',
                            'serial': '1234567890',
                            'connected': 'yes'
                        },
                        {
                            '@name': 'firewall-2',
                            'serial': '0987654321',
                            'connected': 'no'
                        }
                    ]
                },
                {
                    '@name': 'Device-Group-2'
                }
            ]
            ```
        """
        device_group_mappings = []

        # Query Panorama for device groups using the 'show devicegroups' operational command
        device_groups = pan.op("show devicegroups")

        # Iterate over each 'entry' element under 'devicegroups'
        for entry in device_groups.findall(".//devicegroups/entry"):
            entry_dict = {"@name": entry.get("name")}

            # Check if the 'entry' has 'devices' element
            devices_elem = entry.find("devices")
            if devices_elem is not None:
                devices = []

                # Iterate over each 'entry' element under 'devices'
                for device in devices_elem.findall("entry"):
                    device_dict = {
                        "@name": device.get("name"),
                        "serial": device.find("serial").text,
                        "connected": device.find("connected").text,
                    }
                    devices.append(device_dict)

                entry_dict["devices"] = devices

            device_group_mappings.append(entry_dict)

        return device_group_mappings

    @staticmethod
    def find_devicegroup_by_serial(
            data: List[Dict],
            serial: str,
    ) -> Optional[str]:
        """
        Find the device group name for a given device serial number.

        This function iterates through a list of dictionaries representing device groups and their associated devices.
        It searches for a device with the specified serial number and returns the name of the device group if found.

        Args:
            data (List[Dict]): A list of dictionaries containing device group information and associated devices.
                               Each dictionary should have the following structure:
                               {
                                   "@name": "device_group_name",
                                   "devices": [
                                       {
                                           "serial": "device_serial_number",
                                           ...
                                       },
                                       ...
                                   ],
                                   ...
                               }
            serial (str): The serial number of the device to search for.

        Returns: Optional[str]: The name of the device group if the device with the specified serial number is found,
        None otherwise.

        Mermaid Workflow:
            ```mermaid
            graph TD
                A[Start] --> B{Iterate through data}
                B --> C{Device group has "devices" key?}
                C -->|Yes| D{Iterate through devices}
                C -->|No| B
                D --> E{Device serial matches target serial?}
                E -->|Yes| F[Return device group name]
                E -->|No| D
                D --> B
                B --> G{All device groups checked?}
                G -->|Yes| H[Return None]
                G -->|No| B
            ```
        """
        for entry in data:
            # Check if the device group has a "devices" key
            if "devices" in entry:
                for device in entry["devices"]:
                    # Check if the device serial matches the target serial
                    if device["serial"] == serial:
                        return entry["@name"]

        # Return None if the device is not found in any device group
        return None
