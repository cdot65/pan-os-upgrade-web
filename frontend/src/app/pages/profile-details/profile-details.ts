/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/profile-details/profile-details.ts

import { ActivatedRoute, Router } from "@angular/router";
import { Component, HostBinding, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "src/app/shared/footer/footer";
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
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfilePageHeader } from "../profile-page-header/profile-page-header";
import { ProfileService } from "../../shared/services/profile.service";

@Component({
    selector: "app-profile-details",
    templateUrl: "./profile-details.html",
    styleUrls: ["./profile-details.scss"],
    standalone: true,
    imports: [
        CommonModule,
        Footer,
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
        ProfilePageHeader,
        ReactiveFormsModule,
    ],
})

/**
 * Represents the component for displaying and managing an upgrade profile details.
 */
export class ProfileDetailsComponent implements OnInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    updateProfileForm: FormGroup;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private formBuilder: FormBuilder,
        public _componentPageTitle: ComponentPageTitle,
        private profileService: ProfileService,
    ) {
        this.updateProfileForm = this.formBuilder.group({
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
                max_reboot_tries: [33],
                reboot_retry_interval: [66],
            }),
            snapshots: this.formBuilder.group({
                snapshots_location: ["assurance/snapshots/"],
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
    ngOnInit(): void {
        this._componentPageTitle.title = "Settings";
        this.route.paramMap.subscribe((params) => {
            const uuid = params.get("uuid");
            if (uuid) {
                this.profileService.getProfile(uuid).subscribe(
                    (profile: Profile) => {
                        console.log("Retrieved Profile:", profile);
                        this.updateProfileForm.setValue({
                            authentication: {
                                pan_username:
                                    profile.authentication.pan_username,
                                pan_password:
                                    profile.authentication.pan_password,
                            },
                            description: profile.description,
                            download: {
                                max_download_tries:
                                    profile.download.max_download_tries,
                                download_retry_interval:
                                    profile.download.download_retry_interval,
                            },
                            install: {
                                max_install_attempts:
                                    profile.install.max_install_attempts,
                                install_retry_interval:
                                    profile.install.install_retry_interval,
                            },
                            name: profile.name,
                            readiness_checks: {
                                checks: {
                                    active_support_check:
                                        profile.readiness_checks.checks
                                            .active_support_check,
                                    arp_entry_exist_check:
                                        profile.readiness_checks.checks
                                            .arp_entry_exist_check,
                                    candidate_config_check:
                                        profile.readiness_checks.checks
                                            .candidate_config_check,
                                    certificates_requirements_check:
                                        profile.readiness_checks.checks
                                            .certificates_requirements_check,
                                    content_version_check:
                                        profile.readiness_checks.checks
                                            .content_version_check,
                                    dynamic_updates_check:
                                        profile.readiness_checks.checks
                                            .dynamic_updates_check,
                                    expired_licenses_check:
                                        profile.readiness_checks.checks
                                            .expired_licenses_check,
                                    free_disk_space_check:
                                        profile.readiness_checks.checks
                                            .free_disk_space_check,
                                    ha_check:
                                        profile.readiness_checks.checks
                                            .ha_check,
                                    ip_sec_tunnel_status_check:
                                        profile.readiness_checks.checks
                                            .ip_sec_tunnel_status_check,
                                    jobs_check:
                                        profile.readiness_checks.checks
                                            .jobs_check,
                                    ntp_sync_check:
                                        profile.readiness_checks.checks
                                            .ntp_sync_check,
                                    panorama_check:
                                        profile.readiness_checks.checks
                                            .panorama_check,
                                    planes_clock_sync_check:
                                        profile.readiness_checks.checks
                                            .planes_clock_sync_check,
                                    session_exist_check:
                                        profile.readiness_checks.checks
                                            .session_exist_check,
                                },
                                readiness_checks_location:
                                    profile.readiness_checks
                                        .readiness_checks_location,
                            },
                            reboot: {
                                max_reboot_tries:
                                    profile.reboot.max_reboot_tries,
                                reboot_retry_interval:
                                    profile.reboot.reboot_retry_interval,
                            },
                            snapshots: {
                                snapshots_location:
                                    profile.snapshots.snapshots_location,
                                max_snapshot_tries:
                                    profile.snapshots.max_snapshot_tries,
                                snapshot_retry_interval:
                                    profile.snapshots.snapshot_retry_interval,
                                state: {
                                    arp_table_snapshot:
                                        profile.snapshots.state
                                            .arp_table_snapshot,
                                    content_version_snapshot:
                                        profile.snapshots.state
                                            .content_version_snapshot,
                                    ip_sec_tunnels_snapshot:
                                        profile.snapshots.state
                                            .ip_sec_tunnels_snapshot,
                                    license_snapshot:
                                        profile.snapshots.state
                                            .license_snapshot,
                                    nics_snapshot:
                                        profile.snapshots.state.nics_snapshot,
                                    routes_snapshot:
                                        profile.snapshots.state.routes_snapshot,
                                    session_stats_snapshot:
                                        profile.snapshots.state
                                            .session_stats_snapshot,
                                },
                            },
                            timeout_settings: {
                                command_timeout:
                                    profile.timeout_settings.command_timeout,
                                connection_timeout:
                                    profile.timeout_settings.connection_timeout,
                            },
                        });
                        console.log(
                            "Form Value:",
                            this.updateProfileForm.value,
                        );
                    },
                    (error) => {
                        console.error("Error fetching profile:", error);
                    },
                );
            }
        });
    }

    onCancel(): void {
        this.updateProfileForm.reset();
        this.router.navigate(["/profiles"]);
    }

    submitUpdateProfile(): void {
        if (this.updateProfileForm.valid) {
            const settings: Profile = this.updateProfileForm.value;
            console.log("Settings saved:", settings);
            // TODO: Implement saving the settings to the backend API
        }
    }
}
