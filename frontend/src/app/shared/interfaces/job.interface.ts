/* eslint-disable @typescript-eslint/naming-convention */

// frontend/src/app/shared/interfaces/job.interface.ts

export interface Job {
    task_id: string;
    author: number;
    created_at: string;
    updated_at: string;
    job_type: string;
    job_status: string;
    current_step: string;
    // Device fields
    device_group?: string | null;
    ha_enabled?: boolean | null;
    hostname?: string | null;
    local_state?: string | null;
    panorama_managed?: boolean | null;
    peer_device?: string | null;
    peer_state?: string | null;
    platform?: string | null;
    serial?: string | null;
    sw_version?: string | null;
}
