/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/interfaces/job.interface.ts

export interface Job {
    task_id: string;
    author: number;
    created_at: string;
    updated_at: string;
    job_type: string;
    job_status: string;
}
