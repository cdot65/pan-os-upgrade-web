/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-details/profile-details.facade.ts

import { Injectable } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Observable } from "rxjs";
import { ProfileService } from "../../shared/services/profile.service";
import { Profile } from "../../shared/interfaces/profile.interface";

@Injectable()
export class ProfileDetailsFacade {
    constructor(
        private formBuilder: FormBuilder,
        private profileService: ProfileService,
    ) {}

    createProfileForm(): FormGroup {
        return this.formBuilder.group({
            description: [""],
            download: this.formBuilder.group({
                max_download_tries: [22],
                download_retry_interval: [33],
            }),
            install: this.formBuilder.group({
                max_install_attempts: [33],
                install_retry_interval: [66],
            }),
            name: ["", Validators.required],
            readiness_checks: this.formBuilder.group({
                checks: this.formBuilder.group({
                    active_support: [true],
                    candidate_config: [true],
                    certificates_requirements: [false],
                    content_version: [true],
                    dynamic_updates: [true],
                    expired_licenses: [true],
                    free_disk_space: [true],
                    ha: [true],
                    jobs: [false],
                    ntp_sync: [false],
                    panorama: [true],
                    planes_clock_sync: [true],
                }),
            }),
            reboot: this.formBuilder.group({
                max_reboot_tries: [33],
                reboot_retry_interval: [66],
            }),
            snapshots: this.formBuilder.group({
                max_snapshot_tries: [33],
                snapshot_retry_interval: [66],
                state: this.formBuilder.group({
                    arp_table_snapshot: [false],
                    content_version_snapshot: [true],
                    ip_sec_tunnels_snapshot: [false],
                    license_snapshot: [true],
                    nics_snapshot: [true],
                    routes_snapshot: [false],
                    session_stats_snapshot: [false],
                }),
            }),
            timeout_settings: this.formBuilder.group({
                command_timeout: [123321],
                connection_timeout: [33],
            }),
            authentication: this.formBuilder.group({
                pan_username: ["", Validators.required],
                pan_password: ["", Validators.required],
            }),
        });
    }

    getProfile(uuid: string): Observable<Profile> {
        return this.profileService.getProfile(uuid);
    }

    updateProfile(profile: Profile, uuid: string): Observable<any> {
        return this.profileService.updateProfile(profile, uuid);
    }
}
