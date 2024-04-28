# PAN-OS Upgrade Workflows

This repository contains Mermaid workflows for the PAN-OS upgrade process.

## Main Workflow

```mermaid
graph TD
    A[Start] --> B[Import necessary modules and set up Django environment]
    B --> C[Define global variables and configure logging]
    C --> D[Define helper functions]
    D --> E[Define main upgrade functions]
    E --> F[Define entry point for the PAN-OS upgrade script]
    F --> G[Parse command-line arguments]
    G --> H[Configure logging level]
    H --> I[Create a new Job entry]
    I --> J[Call run_panos_upgrade function]
    J --> K{Device panorama managed?}
    K -->|Yes| L[Create Firewall object with serial and Panorama]
    K -->|No| M[Create Firewall object with IP address]
    L --> N[Create device dictionary object]
    M --> N
    N --> O[Add device to upgrade_devices list]
    O --> P{Device in HA pair?}
    P -->|Yes| Q[Create Firewall object for HA peer]
    P -->|No| R[Iterate over passive and active-secondary devices]
    Q --> R
    R --> S[Upgrade passive and active-secondary firewalls]
    S --> T[Iterate over active and active-primary devices]
    T --> U[Upgrade active and active-primary firewalls]
    U --> V[Return JSON output]
    V --> W[End]
```

## Upgrade Firewall Workflow

```mermaid
graph TB
    UF1[Start] --> UF2{Check if upgrade is available}
    UF2 -->|No| UF3[Log error and exit]
    UF2 -->|Yes| UF4{Is firewall part of HA pair?}
    UF4 -->|Yes| UF5{Determine active/passive role}
    UF5 -->|Not ready| UF6[Switch control to peer firewall]
    UF5 -->|Ready| UF7[Proceed with upgrade]
    UF4 -->|No| UF7[Proceed with upgrade]
    UF7 --> UF8{Is target version already downloaded?}
    UF8 -->|Yes| UF9[Log success]
    UF8 -->|No| UF10[Download target version]
    UF10 -->|Success| UF9[Log success]
    UF10 -->|Failure| UF11[Log error and exit]
    UF9 --> UF12[Perform pre-upgrade snapshot]
    UF12 --> UF13[Perform upgrade]
    UF13 -->|Success| UF14[Perform post-upgrade tasks]
    UF13 -->|Failure| UF15[Log error]
    UF14 --> UF16[End]
    UF15 --> UF16[End]
```

## Handle Firewall HA Workflow

```mermaid
graph TB
    HF1[Start] --> HF2{Is target device part of HA?}
    HF2 -->|No| HF3[Proceed with upgrade]
    HF2 -->|Yes| HF4[Get HA details]
    HF4 --> HF5{Are devices synchronized?}
    HF5 -->|No| HF6[Wait and recheck]
    HF5 -->|Yes| HF7{Compare software versions}
    HF7 -->|Equal| HF8{Check local HA state}
    HF8 -->|Active/Active-Primary| HF9[Defer upgrade]
    HF8 -->|Passive/Active-Secondary| HF10[Suspend HA state and proceed]
    HF8 -->|Initial| HF11[Proceed with upgrade]
    HF7 -->|Older| HF12[Suspend HA state of active and proceed]
    HF7 -->|Newer| HF13[Suspend HA state of passive and proceed]
```

## Software Update Check Workflow

```mermaid
graph TB
    SUC1[Start] --> SUC2[Parse target version]
    SUC2 --> SUC3[Check if target version is older than current version]
    SUC3 --> SUC4[Verify compatibility with current version and HA setup]
    SUC4 --> SUC5{Compatible?}
    SUC5 -->|No| SUC6[Return False]
    SUC5 -->|Yes| SUC7[Retrieve available software versions]
    SUC7 --> SUC8{Target version available?}
    SUC8 -->|No| SUC9[Return False]
    SUC8 -->|Yes| SUC10{Base image downloaded?}
    SUC10 -->|Yes| SUC11[Return True]
    SUC10 -->|No| SUC12[Attempt base image download]
    SUC12 --> SUC13{Download successful?}
    SUC13 -->|Yes| SUC14[Wait for image to load]
    SUC14 --> SUC15[Re-check available versions]
    SUC15 --> SUC16{Target version available?}
    SUC16 -->|Yes| SUC17[Return True]
    SUC16 -->|No| SUC18{Retry count exceeded?}
    SUC18 -->|No| SUC19[Retry download]
    SUC19 --> SUC12
    SUC18 -->|Yes| SUC20[Return False]
    SUC13 -->|No| SUC21{Retry count exceeded?}
    SUC21 -->|No| SUC22[Wait and retry download]
    SUC22 --> SUC12
    SUC21 -->|Yes| SUC23[Return False]
```

## Parse Version Workflow

```mermaid
graph TB
    PV1[Start] --> PV2[Remove .xfr suffix from version string]
    PV2 --> PV3[Split version string into parts]
    PV3 --> PV4{Number of parts valid?}
    PV4 -->|No| PV5[Raise ValueError]
    PV4 -->|Yes| PV6{Third part contains invalid characters?}
    PV6 -->|Yes| PV5[Raise ValueError]
    PV6 -->|No| PV7[Extract major and minor parts]
    PV7 --> PV8{Length of parts is 3?}
    PV8 -->|No| PV9[Set maintenance and hotfix to 0]
    PV8 -->|Yes| PV10[Extract maintenance part]
    PV10 --> PV11{Maintenance part contains -h, -c, or -b?}
    PV11 -->|Yes| PV12[Split maintenance part into maintenance and hotfix]
    PV11 -->|No| PV13[Set hotfix to 0]
    PV12 --> PV14{Maintenance and hotfix are digits?}
    PV13 --> PV14{Maintenance and hotfix are digits?}
    PV14 -->|No| PV5[Raise ValueError]
    PV14 -->|Yes| PV15[Convert maintenance and hotfix to integers]
    PV9 --> PV16[Return major, minor, maintenance, hotfix]
    PV15 --> PV16[Return major, minor, maintenance, hotfix]
```

## Get HA Status Workflow

```mermaid
graph TB
    GH1[Start] --> GH2[Log start of getting deployment information]
    GH2 --> GH3[Get deployment type using show_highavailability_state]
    GH3 --> GH4[Log target device deployment type]
    GH4 --> GH5{HA details available?}
    GH5 -->|Yes| GH6[Flatten XML to dictionary]
    GH6 --> GH7[Log target device deployment details collected]
    GH5 -->|No| GH8[Return deployment type and None]
    GH7 --> GH9[Return deployment type and HA details]
```

## Check HA Compatibility Workflow

```mermaid
graph TB
    CH1[Start] --> CH2{Major upgrade more than one release apart?}
    CH2 -->|Yes| CH3[Log warning and return False]
    CH2 -->|No| CH4{Within same major version and minor upgrade more than one release apart?}
    CH4 -->|Yes| CH5[Log warning and return False]
    CH4 -->|No| CH6{Spans exactly one major version and increases minor version?}
    CH6 -->|Yes| CH7[Log warning and return False]
    CH6 -->|No| CH8[Log compatibility check success and return True]
```

## Compare Versions Workflow

```mermaid
graph TB
    CV1[Start] --> CV2[Parse version1]
    CV1 --> CV3[Parse version2]
    CV2 --> CV4{Compare parsed versions}
    CV3 --> CV4
    CV4 -->|version1 < version2| CV5[Return older]
    CV4 -->|version1 > version2| CV6[Return newer]
    CV4 -->|version1 == version2| CV7[Return equal]
```

## Determine Upgrade Workflow

```mermaid
graph TB
    DU1[Start] --> DU2{Is target_maintenance an integer?}
    DU2 -->|Yes| DU3[Set target_version with integer maintenance]
    DU2 -->|No| DU4[Parse target_version from string]
    DU3 --> DU5[Log current and target versions]
    DU4 --> DU5
    DU5 --> DU6{Is current_version_parsed less than target_version?}
    DU6 -->|Yes| DU7[Log upgrade required message]
    DU6 -->|No| DU8[Log no upgrade required or downgrade attempt detected]
    DU8 --> DU9[Log halting upgrade message]
    DU9 --> DU10[Exit the script]
```

## Log Upgrade Workflow

```mermaid
graph TB
    LU1[Start] --> LU2[Create extra dictionary with job details]
    LU2 --> LU3[Get the corresponding logging level using getattr]
    LU3 --> LU4[Log the message with the specified level and extra details]
    LU4 --> LU5[End]
```

## Perform Snapshot Workflow

```mermaid
graph TB
    PS1[Start] --> PS2[Log start of snapshot]
    PS2 --> PS3{Attempt < Max Attempts and Snapshot is None?}
    PS3 -->|Yes| PS4[Try to take snapshot using run_assurance]
    PS4 --> PS5{Snapshot Successful?}
    PS5 -->|Yes| PS6[Log success and return snapshot]
    PS5 -->|No| PS7[Log error and wait for retry interval]
    PS7 --> PS3
    PS3 -->|No| PS8{Snapshot is None?}
    PS8 -->|Yes| PS9[Log failure after max attempts]
    PS8 -->|No| PS10[End]
```

## Run Assurance Workflow

```mermaid
graph TB
    RA1[Start] --> RA2{operation_type?}
    RA2 -->|state_snapshot| RA3[Set up FirewallProxy and CheckFirewall]
    RA3 --> RA4[Validate snapshot actions]
    RA4 --> RA5{Actions valid?}
    RA5 -->|No| RA6[Log error and return]
    RA5 -->|Yes| RA7[Take snapshots]
    RA7 --> RA8{Snapshots successful?}
    RA8 -->|No| RA9[Log error and return]
    RA8 -->|Yes| RA10[Log snapshot results and return results]
    RA2 -->|Other| RA11[Log error and return]
```

## Software Download Workflow

```mermaid
graph TB
    SD1[Start] --> SD2{Is target version already downloaded?}
    SD2 -->|Yes| SD3[Log success and return True]
    SD2 -->|No| SD4{Is target version not downloaded or in downloading state?}
    SD4 -->|Yes| SD5[Log version not found and start download]
    SD4 -->|No| SD6[Log error and exit]
    SD5 --> SD7[Initiate download]
    SD7 --> SD8{Download successful?}
    SD8 -->|Yes| SD9[Log success and return True]
    SD8 -->|No| SD10{Download in progress?}
    SD10 -->|Yes| SD11[Log download progress]
    SD10 -->|No| SD12[Log download failure and return False]
    SD11 --> SD13{Download complete?}
    SD13 -->|Yes| SD9
    SD13 -->|No| SD11
```

## Suspend HA Active Workflow

```mermaid
graph TB
    SHA1[Start] --> SHA2[Send API request to suspend active device]
    SHA2 --> SHA3{Parse XML response}
    SHA3 -->|Success| SHA4[Log success message and return True]
    SHA3 -->|Failure| SHA5[Log failure message and return False]
    SHA2 --> SHA6[Catch exception]
    SHA6 --> SHA7[Log error message and return False]
```

## Suspend HA Passive Workflow

```mermaid
graph TB
    SHP1[Start] --> SHP2[Log start of HA state suspension]
    SHP2 --> SHP3[Send request to suspend HA state]
    SHP3 --> SHP4{Suspension successful?}
    SHP4 -->|Yes| SHP5[Log success and return True]
    SHP4 -->|No| SHP6[Log failure and return False]
    SHP3 --> SHP7[Catch exception]
    SHP7 --> SHP8[Log error and return False]
```