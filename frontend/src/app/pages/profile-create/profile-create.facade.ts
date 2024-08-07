/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-create/profile-create.facade.ts

import { Injectable } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Observable } from "rxjs";
import { ProfileService } from "../../shared/services/profile.service";
import { PROFILE_CREATE_CONFIG } from "./profile-create.config";

@Injectable()
export class ProfileCreateFacade {
    constructor(
        private formBuilder: FormBuilder,
        private profileService: ProfileService,
        private router: Router,
        private snackBar: MatSnackBar,
    ) {}

    createProfileForm(): FormGroup {
        return this.formBuilder.group({
            authentication: this.formBuilder.group({
                pan_username: ["", Validators.required],
                pan_password: ["", Validators.required],
            }),
            description: [""],
            download: this.formBuilder.group({
                max_download_tries: [
                    PROFILE_CREATE_CONFIG.formDefaults.max_download_tries,
                ],
                download_retry_interval: [
                    PROFILE_CREATE_CONFIG.formDefaults.download_retry_interval,
                ],
            }),
            install: this.formBuilder.group({
                max_install_attempts: [
                    PROFILE_CREATE_CONFIG.formDefaults.max_install_attempts,
                ],
                install_retry_interval: [
                    PROFILE_CREATE_CONFIG.formDefaults.install_retry_interval,
                ],
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
                max_reboot_tries: [
                    PROFILE_CREATE_CONFIG.formDefaults.max_reboot_tries,
                ],
                reboot_retry_interval: [
                    PROFILE_CREATE_CONFIG.formDefaults.reboot_retry_interval,
                ],
            }),
            snapshots: this.formBuilder.group({
                max_snapshot_tries: [
                    PROFILE_CREATE_CONFIG.formDefaults.max_snapshot_tries,
                ],
                snapshot_retry_interval: [
                    PROFILE_CREATE_CONFIG.formDefaults.snapshot_retry_interval,
                ],
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
                command_timeout: [
                    PROFILE_CREATE_CONFIG.formDefaults.command_timeout,
                ],
                connection_timeout: [
                    PROFILE_CREATE_CONFIG.formDefaults.connection_timeout,
                ],
            }),
        });
    }

    createProfile(formValue: any): Observable<any> {
        return this.profileService.createProfile(formValue);
    }

    navigateToProfiles(): void {
        this.router.navigate(["/profiles"]);
    }

    showErrorSnackBar(message: string): void {
        this.snackBar.open(message, "Close", {
            duration: PROFILE_CREATE_CONFIG.snackBarDuration,
        });
    }
}
