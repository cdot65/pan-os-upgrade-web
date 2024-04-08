// src/app/shared/interfaces/upgrade-history.interface.ts

export interface UpgradeHistory {
    id: string;
    deviceId: string;
    targetVersion: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    createdBy: string;
}
