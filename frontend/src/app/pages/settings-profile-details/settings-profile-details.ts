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
                maxDownloadTries: [22],
                downloadRetryInterval: [30],
            }),
            install: this.formBuilder.group({
                maxInstallAttempts: [3],
                installRetryInterval: [60],
            }),
            readinessChecks: this.formBuilder.group({
                checks: this.formBuilder.group({
                    activeSupportCheck: [true],
                    arpEntryExistCheck: [false],
                    candidateConfigCheck: [true],
                    certificatesRequirementsCheck: [false],
                    contentVersionCheck: [true],
                    dynamicUpdatesCheck: [true],
                    expiredLicensesCheck: [true],
                    freeDiskSpaceCheck: [true],
                    haCheck: [true],
                    ipSecTunnelStatusCheck: [true],
                    jobsCheck: [false],
                    ntpSyncCheck: [false],
                    panoramaCheck: [true],
                    planesClockSyncCheck: [true],
                    sessionExistCheck: [false],
                }),
                readinessChecksLocation: ["assurance/readiness_checks/"],
            }),
            reboot: this.formBuilder.group({
                maxRebootTries: [30],
                rebootRetryInterval: [60],
            }),
            snapshots: this.formBuilder.group({
                snapshotsLocation: ["assurance/snapshots/"],
                maxSnapshotTries: [3],
                snapshotRetryInterval: [60],
                state: this.formBuilder.group({
                    arpTableSnapshot: [false],
                    contentVersionSnapshot: [true],
                    ipSecTunnelsSnapshot: [false],
                    licenseSnapshot: [true],
                    nicsSnapshot: [true],
                    routesSnapshot: [false],
                    sessionStatsSnapshot: [false],
                }),
            }),
            timeoutSettings: this.formBuilder.group({
                commandTimeout: [120],
                connectionTimeout: [30],
            }),
            authentication: this.formBuilder.group({
                panUsername: ["", Validators.required],
                panPassword: ["", Validators.required],
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
                                    panUsername:
                                        settingsProfile.authentication
                                            .panUsername,
                                    panPassword:
                                        settingsProfile.authentication
                                            .panPassword,
                                },
                                download: {
                                    maxDownloadTries:
                                        settingsProfile.download
                                            .maxDownloadTries,
                                    downloadRetryInterval:
                                        settingsProfile.download
                                            .downloadRetryInterval,
                                },
                                install: {
                                    maxInstallAttempts:
                                        settingsProfile.install
                                            .maxInstallAttempts,
                                    installRetryInterval:
                                        settingsProfile.install
                                            .installRetryInterval,
                                },
                                readinessChecks: {
                                    checks: {
                                        activeSupportCheck:
                                            settingsProfile.readinessChecks
                                                .checks.activeSupportCheck,
                                        arpEntryExistCheck:
                                            settingsProfile.readinessChecks
                                                .checks.arpEntryExistCheck,
                                        candidateConfigCheck:
                                            settingsProfile.readinessChecks
                                                .checks.candidateConfigCheck,
                                        certificatesRequirementsCheck:
                                            settingsProfile.readinessChecks
                                                .checks
                                                .certificatesRequirementsCheck,
                                        contentVersionCheck:
                                            settingsProfile.readinessChecks
                                                .checks.contentVersionCheck,
                                        dynamicUpdatesCheck:
                                            settingsProfile.readinessChecks
                                                .checks.dynamicUpdatesCheck,
                                        expiredLicensesCheck:
                                            settingsProfile.readinessChecks
                                                .checks.expiredLicensesCheck,
                                        freeDiskSpaceCheck:
                                            settingsProfile.readinessChecks
                                                .checks.freeDiskSpaceCheck,
                                        haCheck:
                                            settingsProfile.readinessChecks
                                                .checks.haCheck,
                                        ipSecTunnelStatusCheck:
                                            settingsProfile.readinessChecks
                                                .checks.ipSecTunnelStatusCheck,
                                        jobsCheck:
                                            settingsProfile.readinessChecks
                                                .checks.jobsCheck,
                                        ntpSyncCheck:
                                            settingsProfile.readinessChecks
                                                .checks.ntpSyncCheck,
                                        panoramaCheck:
                                            settingsProfile.readinessChecks
                                                .checks.panoramaCheck,
                                        planesClockSyncCheck:
                                            settingsProfile.readinessChecks
                                                .checks.planesClockSyncCheck,
                                        sessionExistCheck:
                                            settingsProfile.readinessChecks
                                                .checks.sessionExistCheck,
                                    },
                                    readinessChecksLocation:
                                        settingsProfile.readinessChecks
                                            .readinessChecksLocation,
                                },
                                reboot: {
                                    maxRebootTries:
                                        settingsProfile.reboot.maxRebootTries,
                                    rebootRetryInterval:
                                        settingsProfile.reboot
                                            .rebootRetryInterval,
                                },
                                snapshots: {
                                    snapshotsLocation:
                                        settingsProfile.snapshots
                                            .snapshotsLocation,
                                    maxSnapshotTries:
                                        settingsProfile.snapshots
                                            .maxSnapshotTries,
                                    snapshotRetryInterval:
                                        settingsProfile.snapshots
                                            .snapshotRetryInterval,
                                    state: {
                                        arpTableSnapshot:
                                            settingsProfile.snapshots.state
                                                .arpTableSnapshot,
                                        contentVersionSnapshot:
                                            settingsProfile.snapshots.state
                                                .contentVersionSnapshot,
                                        ipSecTunnelsSnapshot:
                                            settingsProfile.snapshots.state
                                                .ipSecTunnelsSnapshot,
                                        licenseSnapshot:
                                            settingsProfile.snapshots.state
                                                .licenseSnapshot,
                                        nicsSnapshot:
                                            settingsProfile.snapshots.state
                                                .nicsSnapshot,
                                        routesSnapshot:
                                            settingsProfile.snapshots.state
                                                .routesSnapshot,
                                        sessionStatsSnapshot:
                                            settingsProfile.snapshots.state
                                                .sessionStatsSnapshot,
                                    },
                                },
                                timeoutSettings: {
                                    commandTimeout:
                                        settingsProfile.timeoutSettings
                                            .commandTimeout,
                                    connectionTimeout:
                                        settingsProfile.timeoutSettings
                                            .connectionTimeout,
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
