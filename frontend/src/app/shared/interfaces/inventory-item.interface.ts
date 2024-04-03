/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/interfaces/inventory-item.interface.ts

export interface InventoryItem {
    // author: number;
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
    uuid: string;
}
