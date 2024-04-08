// src/app/shared/interfaces/upgrade-form.interface.ts

export interface UpgradeForm {
    author: number;
    device: string;
    profile: string;
    targetVersion?: string;
    scheduledAt?: Date;
}
