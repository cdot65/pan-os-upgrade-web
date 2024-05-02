/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/interfaces/upgrade-history.interface.ts

export interface UpgradeHistory {
    id: string;
    deviceId: string;
    target_version: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    createdBy: string;
}
