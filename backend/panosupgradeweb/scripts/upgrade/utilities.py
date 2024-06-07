import re
from typing import Tuple, List


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

