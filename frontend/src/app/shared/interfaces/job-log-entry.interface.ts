/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/interfaces/job-log-entry.ts
import { JobStatus } from "./job.interface";

export interface JobLogEntry {
    timestamp: string;
    severity_level: string;
    message: string;
}

export interface JobStatusAndLogs {
    job: JobStatus;
    logs: JobLogEntry[];
}
