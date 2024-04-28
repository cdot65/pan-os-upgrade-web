/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/interfaces/upgrade-form.interface.ts

export interface UpgradeForm {
    author: number;
    devices: string[];
    dry_run: boolean;
    profile: string;
    target_version?: string;
}
