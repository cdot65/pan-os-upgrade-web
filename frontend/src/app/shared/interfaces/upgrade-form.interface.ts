// src/app/shared/interfaces/upgrade-form.interface.ts

export interface UpgradeForm {
    author: number;
    devices: string[];
    profile: string;
    targetVersion?: string;
}
