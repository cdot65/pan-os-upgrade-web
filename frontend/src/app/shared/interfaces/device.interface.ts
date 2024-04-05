/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/interfaces/inventory-item.interface.ts

export interface Device {
    // author: number;
    app_version: string;
    created_at: string;
    device_group: string | null;
    device_type: string;
    ha: boolean;
    ha_peer: string | null;
    hostname: string;
    ipv4_address: string;
    ipv6_address: string | null;
    notes: string;
    panorama_appliance: string | null;
    panorama_managed: boolean;
    platform_name: string;
    serial_number: string;
    sw_version: string;
    threat_version: string;
    uptime: string;
    uuid: string;
}
