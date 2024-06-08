import re
from typing import Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET


def parse_version(
        version: str,
) -> Tuple[int, int, int, int]:
    """
    Parse a version string into its major, minor, maintenance, and hotfix components.

    This function takes a version string in the format "major.minor[.maintenance[-h|-c|-b]hotfix][.xfr]"
    and returns a tuple of four integers representing the major, minor, maintenance, and hotfix parts
    of the version. It handles various version formats and validates the input to ensure it follows
    the expected format.

    Args:
        version (str): The version string to parse. It should be in the format
            "major.minor[.maintenance[-h|-c|-b]hotfix][.xfr]".

    Returns:
        Tuple[int, int, int, int]: A tuple containing the major, minor, maintenance, and hotfix
            parts of the version as integers.

    Raises:
        ValueError: If the version string is in an invalid format or contains invalid characters.
            The specific error message will indicate the reason for the invalid format.

    Notes:
        - If the version string ends with ".xfr", it will be removed before parsing, keeping the
          hotfix part intact.
        - If the maintenance part is not present, it will default to 0.
        - If the hotfix part is not present, it will default to 0.

    Examples:
        >>> parse_version("10.1.2")
        (10, 1, 2, 0)
        >>> parse_version("10.1.2-h3")
        (10, 1, 2, 3)
        >>> parse_version("10.1.2-c4")
        (10, 1, 2, 4)
        >>> parse_version("10.1.2-b5")
        (10, 1, 2, 5)
        >>> parse_version("10.1.2.xfr")
        (10, 1, 2, 0)
        >>> parse_version("10.1")
        (10, 1, 0, 0)

    Mermaid Workflow:
        ```mermaid
        graph TD
            A[Start] --> B[Remove .xfr suffix from version string]
            B --> C[Split version string into parts]
            C --> D{Number of parts valid?}
            D -->|No| E[Raise ValueError]
            D -->|Yes| F{Third part contains invalid characters?}
            F -->|Yes| E[Raise ValueError]
            F -->|No| G[Extract major and minor parts]
            G --> H{Length of parts is 3?}
            H -->|No| I[Set maintenance and hotfix to 0]
            H -->|Yes| J[Extract maintenance part]
            J --> K{Maintenance part contains -h, -c, or -b?}
            K -->|Yes| L[Split maintenance part into maintenance and hotfix]
            K -->|No| M[Set hotfix to 0]
            L --> N{Maintenance and hotfix are digits?}
            M --> N{Maintenance and hotfix are digits?}
            N -->|No| E[Raise ValueError]
            N -->|Yes| O[Convert maintenance and hotfix to integers]
            I --> P[Return major, minor, maintenance, hotfix]
            O --> P[Return major, minor, maintenance, hotfix]
        ```
    """
    # Remove .xfr suffix from the version string, keeping the hotfix part intact
    version = re.sub(r"\.xfr$", "", version)

    parts = version.split(".")

    # Ensure there are two or three parts, and if three, the third part does not contain invalid characters like 'h'
    # or 'c' without a preceding '-'
    if (
            len(parts) < 2
            or len(parts) > 3
            or (len(parts) == 3 and re.search(r"[^0-9\-]h|[^0-9\-]c", parts[2]))
    ):
        raise ValueError(f"Invalid version format: '{version}'.")

    major, minor = map(int, parts[:2])  # Raises ValueError if conversion fails

    maintenance = 0
    hotfix = 0

    if len(parts) == 3:
        maintenance_part = parts[2]
        if "-h" in maintenance_part:
            maintenance_str, hotfix_str = maintenance_part.split("-h")
        elif "-c" in maintenance_part:
            maintenance_str, hotfix_str = maintenance_part.split("-c")
        elif "-b" in maintenance_part:
            maintenance_str, hotfix_str = maintenance_part.split("-b")
        else:
            maintenance_str = maintenance_part
            hotfix_str = "0"

        # Validate and convert maintenance and hotfix parts
        if not maintenance_str.isdigit() or not hotfix_str.isdigit():
            raise ValueError(
                f"Invalid maintenance or hotfix format in version '{version}'."
            )

        maintenance = int(maintenance_str)
        hotfix = int(hotfix_str)

    return major, minor, maintenance, hotfix


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


def flatten_xml_to_dict(element: ET.Element) -> dict:
    """
    Converts an XML ElementTree element into a nested dictionary, maintaining its hierarchical structure.

    This function iterates over the provided XML ElementTree element, converting each element and its children into a nested dictionary format. Element tags serve as dictionary keys, and the element text content, if present, is assigned as the value. For elements with child elements, a new nested dictionary is created to represent the hierarchy. When an element tag is repeated within the same level, these elements are aggregated into a list under a single dictionary key, preserving the structure and multiplicity of the XML data.

    Parameters
    ----------
    element : ET.Element
        The root or any sub-element of an XML tree that is to be converted into a dictionary.

    Returns
    -------
    dict
        A dictionary representation of the input XML element, where each key corresponds to an element tag, and each value is either the text content of the element, a nested dictionary (for child elements), or a list of dictionaries (for repeated child elements).

    Examples
    --------
    Converting a simple XML element:
        >>> xml_string = '<status>active</status>'
        >>> element = ET.fromstring(xml_string)
        >>> flatten_xml_to_dict(element)
        {'status': 'active'}

    Converting an XML element with nested children:
        >>> xml_string = '<configuration><item key="1">Value1</item><item key="2">Value2</item></configuration>'
        >>> element = ET.fromstring(xml_string)
        >>> flatten_xml_to_dict(element)
        {'configuration': {'item': [{'key': '1', '_text': 'Value1'}, {'key': '2', '_text': 'Value2'}]}}

    Notes
    -----
    - This function is designed to work with XML structures that are naturally representable as a nested dictionary. It may not be suitable for XML with complex attributes or mixed content.
    - Attributes of XML elements are converted into dictionary keys with a leading underscore ('_') to differentiate them from child elements.
    - If the XML structure includes elements with repeated tags at the same level, these are stored in a list under the same key to preserve the structure within the dictionary format.
    - The function simplifies XML data handling by converting it into a more accessible and manipulable Python dictionary format.

    Raises
    ------
    ValueError
        If the XML structure includes elements that cannot be directly mapped to a dictionary format without ambiguity or loss of information, a ValueError is raised to indicate potential data integrity issues.
    """

    # Dictionary to hold the XML structure
    result = {}

    # Iterate through each child in the XML element
    for child_element in element:
        child_tag = child_element.tag

        if child_element.text and len(child_element) == 0:
            result[child_tag] = child_element.text
        else:
            if child_tag in result:
                if not isinstance(result.get(child_tag), list):
                    result[child_tag] = [
                        result.get(child_tag),
                        flatten_xml_to_dict(element=child_element),
                    ]
                else:
                    result[child_tag].append(flatten_xml_to_dict(element=child_element))
            else:
                if child_tag == "entry":
                    # Always assume entries are a list.
                    result[child_tag] = [flatten_xml_to_dict(element=child_element)]
                else:
                    result[child_tag] = flatten_xml_to_dict(element=child_element)

    return result


def get_emoji(action: str) -> str:
    """
    Maps specific action keywords to their corresponding emoji symbols for enhanced log and user interface messages.

    This utility function is designed to add visual cues to log messages or user interface outputs by associating specific action keywords with relevant emoji symbols. It aims to improve the readability and user experience by providing a quick visual reference for the action's nature or outcome. The function supports a predefined set of keywords, each mapping to a unique emoji. If an unrecognized keyword is provided, the function returns an empty string to ensure seamless operation without interrupting the application flow.

    Parameters
    ----------
    action : str
        A keyword representing the action or status for which an emoji is required. Supported keywords include 'success', 'error', 'warning', 'working', 'report', 'search', 'save', 'stop', and 'start'.

    Returns
    -------
    str
        The emoji symbol associated with the specified action keyword. Returns an empty string if the keyword is not recognized, maintaining non-disruptive output.

    Examples
    --------
    Adding visual cues to log messages:
        >>> logging.info(f"{get_emoji(action='success')} Operation successful.")
        >>> logging.error(f"{get_emoji(action='error')} An error occurred.")

    Enhancing user prompts in a command-line application:
        >>> print(f"{get_emoji(action='start')} Initiating the process.")
        >>> print(f"{get_emoji(action='stop')} Process terminated.")

    Notes
    -----
    - The function enhances the aesthetic and functional aspects of textual outputs, making them more engaging and easier to interpret at a glance.
    - It is implemented with a fail-safe approach, where unsupported keywords result in an empty string, thus preserving the integrity and continuity of the output.
    - Customization or extension of the supported action keywords and their corresponding emojis can be achieved by modifying the internal emoji_map dictionary.

    This function is not expected to raise any exceptions, ensuring stable and predictable behavior across various usage contexts.
    """

    emoji_map = {
        "success": "✅",
        "warning": "🟧",
        "error": "❌",
        "working": "🔧",
        "report": "📝",
        "search": "🔍",
        "save": "💾",
        "skipped": "🟨",
        "stop": "🛑",
        "start": "🚀",
    }
    return emoji_map.get(action, "")
