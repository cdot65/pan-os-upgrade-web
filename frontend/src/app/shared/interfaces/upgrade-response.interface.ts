/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/interfaces/upgrade-response.interface.ts

export interface UpgradeJob {
    hostname: string;
    job: string;
}

export interface UpgradeResponse {
    upgrade_jobs: UpgradeJob[];
}
