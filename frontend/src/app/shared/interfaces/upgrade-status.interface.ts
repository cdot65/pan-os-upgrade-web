// src/app/shared/interfaces/upgrade-status.interface.ts

export interface UpgradeStatus {
    jobId: string;
    deviceId: string;
    status: string;
    progress: number;
    message?: string;
    startedAt: Date;
    estimatedCompletion?: Date;
}
