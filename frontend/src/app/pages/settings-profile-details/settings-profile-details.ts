/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/settings-profile-details/settings-profile-details.ts

import { ActivatedRoute, Router } from "@angular/router";
import { Component, HostBinding, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { ComponentPageTitle } from "../page-title/page-title";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatOptionModule } from "@angular/material/core";
import { MatRadioModule } from "@angular/material/radio";
import { MatSelectModule } from "@angular/material/select";
import { MatSliderModule } from "@angular/material/slider";
import { SettingsPageHeader } from "../settings-page-header/settings-page-header";
import { SettingsProfile } from "../../shared/interfaces/settings-profile.interface";
import { SettingsProfileService } from "../../shared/services/settings-profile.service";

@Component({
    selector: "app-settings-profile-details",
    templateUrl: "./settings-profile-details.html",
    styleUrls: ["./settings-profile-details.scss"],
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        MatOptionModule,
        MatSelectModule,
        MatRadioModule,
        MatSliderModule,
        SettingsPageHeader,
    ],
})
export class SettingsProfileDetailsComponent implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    settingsForm: FormGroup;
    settingsProfiles: SettingsProfile[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private formBuilder: FormBuilder,
        public _componentPageTitle: ComponentPageTitle,
        private settingsProfileService: SettingsProfileService,
    ) {
        this.settingsForm = this.formBuilder.group({
            profile: ["", Validators.required],
            description: [""],
            download: this.formBuilder.group({
                max_download_tries: [22],
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
        this._componentPageTitle.title = "Settings";
        this.route.paramMap.subscribe((params) => {
            const uuid = params.get("uuid");
            if (uuid) {
                this.settingsProfileService
                    .getSettingsByProfile(uuid)
                    .subscribe(
                        (settingsProfile: SettingsProfile) => {
                            console.log(
                                "Retrieved SettingsProfile:",
                                settingsProfile,
                            );
                            this.settingsForm.setValue({
                                profile: settingsProfile.profile,
                                description: settingsProfile.description,
                                authentication: {
                                    pan_username:
                                        settingsProfile.authentication
                                            .pan_username,
                                    pan_password:
                                        settingsProfile.authentication
                                            .pan_password,
                                },
                                download: {
                                    max_download_tries:
                                        settingsProfile.download
                                            .max_download_tries,
                                    download_retry_interval:
                                        settingsProfile.download
                                            .download_retry_interval,
                                },
                                install: {
                                    max_install_attempts:
                                        settingsProfile.install
                                            .max_install_attempts,
                                    install_retry_interval:
                                        settingsProfile.install
                                            .install_retry_interval,
                                },
                                readiness_checks: {
                                    checks: {
                                        active_support_check:
                                            settingsProfile.readiness_checks
                                                .checks.active_support_check,
                                        arp_entry_exist_check:
                                            settingsProfile.readiness_checks
                                                .checks.arp_entry_exist_check,
                                        candidate_config_check:
                                            settingsProfile.readiness_checks
                                                .checks.candidate_config_check,
                                        certificates_requirements_check:
                                            settingsProfile.readiness_checks
                                                .checks
                                                .certificates_requirements_check,
                                        content_version_check:
                                            settingsProfile.readiness_checks
                                                .checks.content_version_check,
                                        dynamic_updates_check:
                                            settingsProfile.readiness_checks
                                                .checks.dynamic_updates_check,
                                        expired_licenses_check:
                                            settingsProfile.readiness_checks
                                                .checks.expired_licenses_check,
                                        free_disk_space_check:
                                            settingsProfile.readiness_checks
                                                .checks.free_disk_space_check,
                                        ha_check:
                                            settingsProfile.readiness_checks
                                                .checks.ha_check,
                                        ip_sec_tunnel_status_check:
                                            settingsProfile.readiness_checks
                                                .checks
                                                .ip_sec_tunnel_status_check,
                                        jobs_check:
                                            settingsProfile.readiness_checks
                                                .checks.jobs_check,
                                        ntp_sync_check:
                                            settingsProfile.readiness_checks
                                                .checks.ntp_sync_check,
                                        panorama_check:
                                            settingsProfile.readiness_checks
                                                .checks.panorama_check,
                                        planes_clock_sync_check:
                                            settingsProfile.readiness_checks
                                                .checks.planes_clock_sync_check,
                                        session_exist_check:
                                            settingsProfile.readiness_checks
                                                .checks.session_exist_check,
                                    },
                                    readiness_checks_location:
                                        settingsProfile.readiness_checks
                                            .readiness_checks_location,
                                },
                                reboot: {
                                    max_reboot_tries:
                                        settingsProfile.reboot.max_reboot_tries,
                                    reboot_retry_interval:
                                        settingsProfile.reboot
                                            .reboot_retry_interval,
                                },
                                snapshots: {
                                    snapshots_location:
                                        settingsProfile.snapshots
                                            .snapshots_location,
                                    max_snapshot_tries:
                                        settingsProfile.snapshots
                                            .max_snapshot_tries,
                                    snapshot_retry_interval:
                                        settingsProfile.snapshots
                                            .snapshot_retry_interval,
                                    state: {
                                        arp_table_snapshot:
                                            settingsProfile.snapshots.state
                                                .arp_table_snapshot,
                                        content_version_snapshot:
                                            settingsProfile.snapshots.state
                                                .content_version_snapshot,
                                        ip_sec_tunnels_snapshot:
                                            settingsProfile.snapshots.state
                                                .ip_sec_tunnels_snapshot,
                                        license_snapshot:
                                            settingsProfile.snapshots.state
                                                .license_snapshot,
                                        nics_snapshot:
                                            settingsProfile.snapshots.state
                                                .nics_snapshot,
                                        routes_snapshot:
                                            settingsProfile.snapshots.state
                                                .routes_snapshot,
                                        session_stats_snapshot:
                                            settingsProfile.snapshots.state
                                                .session_stats_snapshot,
                                    },
                                },
                                timeout_settings: {
                                    command_timeout:
                                        settingsProfile.timeout_settings
                                            .command_timeout,
                                    connection_timeout:
                                        settingsProfile.timeout_settings
                                            .connection_timeout,
                                },
                            });
                            console.log("Form Value:", this.settingsForm.value);
                        },
                        (error) => {
                            console.error(
                                "Error fetching settings profile:",
                                error,
                            );
                        },
                    );
            }
        });
    }

    formatLabel(value: number): string {
        if (value >= 1000) {
            return Math.round(value / 1000) + "k";
        }
        return `${value}`;
    }

    onCancel(): void {
        this.settingsForm.reset();
        this.router.navigate(["/settings/profiles"]);
    }

    onSubmit(): void {
        if (this.settingsForm.valid) {
            const settings: SettingsProfile = this.settingsForm.value;
            console.log("Settings saved:", settings);
            // TODO: Implement saving the settings to the backend API
        }
    }
}
