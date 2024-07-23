/* eslint-disable @typescript-eslint/naming-convention */

// frontend/src/app/shared/interfaces/job.interface.ts

export interface Device {
    device_group: string;
    ha_enabled: boolean;
    hostname: string;
    local_state: string;
    panorama_managed: boolean;
    peer_device: string;
    peer_state: string;
    platform: string;
    serial: string;
    sw_version: string;
}

export interface JobStatus {
    task_id: string;
    author: number;
    created_at: string;
    updated_at: string;
    job_type: string;
    job_status: string;
    current_device: string;
    current_step: string;
    devices: {
        target: Device;
        peer?: Device;
    };
}
