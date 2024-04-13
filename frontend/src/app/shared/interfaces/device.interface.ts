/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/interfaces/device.interface.ts
export interface Device {
    app_version: string | null;
    created_at: string;
    device_group: string | null;
    device_type: string;
    ha_enabled: boolean | null;
    hostname: string;
    ipv4_address: string | null;
    ipv6_address: string | null;
    local_state: string | null;
    notes: string | null;
    panorama_appliance: string | null;
    panorama_ipv4_address: string | null;
    panorama_ipv6_address: string | null;
    panorama_managed: boolean | null;
    peer_device: string | null;
    peer_device_id: string | null;
    peer_ip: string | null;
    peer_state: string | null;
    platform_name: string;
    serial: string | null;
    sw_version: string | null;
    threat_version: string | null;
    uptime: string | null;
    uuid: string;
}
