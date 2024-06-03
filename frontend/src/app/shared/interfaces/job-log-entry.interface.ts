/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/interfaces/job-log-entry.ts
import { Job } from "./job.interface";

export interface JobLogEntry {
    timestamp: string;
    severity_level: string;
    message: string;
}

export interface JobDetails {
    job: Job;
    logs: JobLogEntry[];
}
