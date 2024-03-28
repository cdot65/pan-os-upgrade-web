/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/interfaces/inventory-list-response.interface.ts

export interface InventoryList {
    author: number;
    createdAt: string;
    deviceType: string;
    ha: boolean;
    haPeer: string | null;
    hostname: string;
    ipv4Address: string;
    ipv6Address: string;
    notes: string;
    platform: string;
    uuid: string;
}

export interface InventoryListApiResponse {
    author: number;
    created_at: string;
    device_type: string;
    ha: boolean;
    ha_peer: string | null;
    hostname: string;
    ipv4_address: string;
    ipv6_address: string;
    notes: string;
    platform: string;
    uuid: string;
}
