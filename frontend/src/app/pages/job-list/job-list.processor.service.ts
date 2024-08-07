/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/job-list/job-list.processor.service.ts

import { Injectable } from "@angular/core";
import { JobStatus } from "../../shared/interfaces/job.interface";

@Injectable({
    providedIn: "root",
})
export class JobListProcessorService {
    isAllSelected(selected: JobStatus[], total: JobStatus[]): boolean {
        return selected.length === total.length;
    }

    checkboxLabel(isAllSelected: boolean, row?: JobStatus): string {
        if (!row) {
            return `${isAllSelected ? "select" : "deselect"} all`;
        }
        return `${isAllSelected ? "deselect" : "select"} row ${row.job_type}`;
    }
}
