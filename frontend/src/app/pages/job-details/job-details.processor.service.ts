/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/job-details/job-details.processor.service.ts

import { Injectable } from "@angular/core";

@Injectable({
    providedIn: "root",
})
export class JobDetailsProcessorService {
    processJobDetailsTableData(
        jobDetails: any,
    ): { key: string; value: string }[] {
        if (!jobDetails?.job) {
            return [];
        }
        return [
            { key: "Job Type", value: jobDetails.job.job_type },
            { key: "Created at", value: jobDetails.job.created_at },
            { key: "Updated at", value: jobDetails.job.updated_at },
            { key: "Status", value: jobDetails.job.job_status },
            {
                key: "Device Group",
                value: jobDetails.job.devices.target.device_group || "N/A",
            },
            {
                key: "HA Enabled",
                value: jobDetails.job.devices.target.ha_enabled ? "Yes" : "No",
            },
            {
                key: "Hostname",
                value: jobDetails.job.devices.target.hostname || "N/A",
            },
            {
                key: "Local State",
                value: jobDetails.job.devices.target.local_state || "N/A",
            },
            {
                key: "Panorama Managed",
                value: jobDetails.job.devices.target.panorama_managed
                    ? "Yes"
                    : "No",
            },
            {
                key: "Peer Device",
                value: jobDetails.job.devices.target.peer_device || "N/A",
            },
            {
                key: "Peer State",
                value: jobDetails.job.devices.target.peer_state || "N/A",
            },
            {
                key: "Platform",
                value: jobDetails.job.devices.target.platform || "N/A",
            },
            {
                key: "Serial",
                value: jobDetails.job.devices.target.serial || "N/A",
            },
            {
                key: "Software Version",
                value: jobDetails.job.devices.target.sw_version || "N/A",
            },
        ];
    }

    isJobInProgress(status: string): boolean {
        return status === "pending" || status === "running";
    }
}
