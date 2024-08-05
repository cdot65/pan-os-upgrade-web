// src/app/pages/homepage/homepage-processor.service.ts

import { Injectable } from "@angular/core";
import { Device } from "../../shared/interfaces/device.interface";
import { JobStatus } from "../../shared/interfaces/job.interface";

@Injectable({
    providedIn: "root",
})
export class HomepageProcessorService {
    processVersionData(
        devices: Device[],
        versionKey: "sw_version" | "app_version",
    ): { name: string; value: number }[] {
        const versionCounts = new Map<string, number>();

        devices.forEach((device: Device) => {
            const version = device[versionKey];
            if (version) {
                versionCounts.set(
                    version,
                    (versionCounts.get(version) || 0) + 1,
                );
            }
        });

        return Array.from(versionCounts, ([name, value]) => ({ name, value }));
    }

    processVersionByDeviceGroupData(
        devices: Device[],
        versionKey: "sw_version" | "app_version",
    ): any[] {
        const groupData = new Map<string, Map<string, number>>();

        devices.forEach((device: Device) => {
            if (device.device_group && device[versionKey]) {
                if (!groupData.has(device.device_group)) {
                    groupData.set(
                        device.device_group,
                        new Map<string, number>(),
                    );
                }
                const versionMap = groupData.get(device.device_group)!;
                versionMap.set(
                    device[versionKey]!,
                    (versionMap.get(device[versionKey]!) || 0) + 1,
                );
            }
        });

        return Array.from(groupData.entries()).map(
            ([deviceGroup, versionMap]) => ({
                name: deviceGroup,
                series: Array.from(versionMap.entries()).map(
                    ([version, count]) => ({
                        name: version,
                        value: count,
                    }),
                ),
            }),
        );
    }

    processJobData(jobs: JobStatus[]): any[] {
        const jobTypeMap = new Map<string, Map<string, number>>();

        jobs.forEach((job) => {
            if (!jobTypeMap.has(job.job_type)) {
                jobTypeMap.set(job.job_type, new Map<string, number>());
            }
            const statusMap = jobTypeMap.get(job.job_type)!;
            statusMap.set(
                job.job_status,
                (statusMap.get(job.job_status) || 0) + 1,
            );
        });

        return Array.from(jobTypeMap.entries()).map(([jobType, statusMap]) => ({
            name: jobType,
            series: Array.from(statusMap.entries()).map(([status, count]) => ({
                name: status,
                value: count,
            })),
        }));
    }
}
