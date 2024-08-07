/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/upgrade-list/upgrade-list.facade.ts

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { InventoryService } from "../../shared/services/inventory.service";
import { ProfileService } from "../../shared/services/profile.service";
import { UpgradeService } from "../../shared/services/upgrade.service";
import { JobService } from "src/app/shared/services/job.service";
import { Device } from "../../shared/interfaces/device.interface";
import { Profile } from "../../shared/interfaces/profile.interface";
import { PanosVersion } from "../../shared/interfaces/panos-version.interface";
import { UpgradeForm } from "../../shared/interfaces/upgrade-form.interface";
import { UpgradeResponse } from "../../shared/interfaces/upgrade-response.interface";

@Injectable()
export class UpgradeListFacade {
    constructor(
        private inventoryService: InventoryService,
        private profileService: ProfileService,
        public upgradeService: UpgradeService,
        private jobService: JobService,
    ) {}

    getDevices(): Observable<Device[]> {
        return this.inventoryService.getDevices();
    }

    getProfiles(): Observable<Profile[]> {
        return this.profileService.getProfiles();
    }

    getPanosVersions(): Observable<PanosVersion[]> {
        return this.upgradeService.getPanosVersions();
    }

    upgradeDevice(
        upgradeFormData: UpgradeForm,
    ): Observable<UpgradeResponse | null> {
        return this.upgradeService.upgradeDevice(upgradeFormData);
    }

    syncPanosVersions(
        deviceId: string,
        profileId: string,
    ): Observable<string | null> {
        return this.upgradeService.syncPanosVersions(deviceId, profileId);
    }

    getJobStatus(jobId: string): Observable<string> {
        return this.jobService.getJobStatus(jobId);
    }
}
