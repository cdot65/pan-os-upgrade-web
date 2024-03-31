/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/settings-profile-create/settings-profile-create.ts

import { Component, HostBinding, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { Router } from "@angular/router";
import { SettingsPageHeader } from "../settings-page-header/settings-page-header";
import { SettingsProfileService } from "../../shared/services/settings-profile.service";

@Component({
    selector: "app-settings-profile-create",
    templateUrl: "./settings-profile-create.html",
    styleUrls: ["./settings-profile-create.scss"],
    standalone: true,
    imports: [
        CommonModule,
        SettingsPageHeader,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
})
export class SettingsProfileCreateComponent implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    settingsProfileForm: FormGroup;

    constructor(
        private formBuilder: FormBuilder,
        private settingsProfileService: SettingsProfileService,
        private router: Router,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.settingsProfileForm = this.formBuilder.group({
            profile: ["", Validators.required],
            description: [""],
            download: this.formBuilder.group({
                max_download_tries: [3],
                download_retry_interval: [30],
            }),
            install: this.formBuilder.group({
                max_install_attempts: [3],
                install_retry_interval: [60],
            }),
            readiness_checks: this.formBuilder.group({
                checks: this.formBuilder.group({
                    active_support_check: [true],
                    arp_entry_exist_check: [false],
                    candidate_config_check: [true],
                    certificates_requirements_check: [false],
                    content_version_check: [true],
                    dynamic_updates_check: [true],
                    expired_licenses_check: [true],
                    free_disk_space_check: [true],
                    ha_check: [true],
                    ip_sec_tunnel_status_check: [true],
                    jobs_check: [false],
                    ntp_sync_check: [false],
                    panorama_check: [true],
                    planes_clock_sync_check: [true],
                    session_exist_check: [false],
                }),
                readiness_checks_location: ["assurance/readiness_checks/"],
            }),
            reboot: this.formBuilder.group({
                max_reboot_tries: [30],
                reboot_retry_interval: [60],
            }),
            snapshots: this.formBuilder.group({
                snapshots_location: ["assurance/snapshots/"],
                max_snapshot_tries: [3],
                snapshot_retry_interval: [60],
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
                command_timeout: [120],
                connection_timeout: [30],
            }),
            authentication: this.formBuilder.group({
                pan_username: ["", Validators.required],
                pan_password: ["", Validators.required],
            }),
        });
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Create Settings Profile";
    }

    submitCreateProfile(): void {
        if (this.settingsProfileForm && this.settingsProfileForm.valid) {
            const formValue = this.settingsProfileForm.value;
            this.settingsProfileService
                .createSettingsProfile(formValue)
                .subscribe(
                    () => {
                        this.router.navigate(["/settings/profiles"]);
                    },
                    (error) => {
                        console.error(
                            "Error creating settings profile:",
                            error,
                        );
                    },
                );
        }
    }

    onCancel(): void {
        this.settingsProfileForm.reset();
        this.router.navigate(["/settings/profiles"]);
    }
}
