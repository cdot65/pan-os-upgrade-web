/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/interfaces/inventory-list-response.interface.ts

export interface InventoryList {
    uuid: string;
    apiKey: string;
    author: string;
    createdAt: string;
    hostname: string;
    ipv4Address: string;
    ipv6Address: string;
    notes: string;
    ha: boolean;
    haPeer: string | null;
    platform: string;
    inventoryType: string;
}

export interface InventoryListApiResponse {
    uuid: string;
    api_key: string;
    author: string;
    created_at: string;
    hostname: string;
    ipv4_address: string;
    ipv6_address: string;
    notes: string;
    ha: boolean;
    ha_peer: string | null;
    platform: string;
    inventory_type: string;
}
