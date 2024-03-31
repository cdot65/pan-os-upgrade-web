// src/app/pages/settings-profile-details/settings-profile-details.ts

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
import { Router } from "@angular/router";
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
        private router: Router,
        private formBuilder: FormBuilder,
        public _componentPageTitle: ComponentPageTitle,
        private settingsProfileService: SettingsProfileService,
    ) {
        this.settingsForm = this.formBuilder.group({
            authentication: this.formBuilder.group({
                panUsername: [""],
                panPassword: [""],
            }),
            download: this.formBuilder.group({
                maxDownloadTries: [3, Validators.min(1)],
                downloadRetryInterval: [60, Validators.min(1)],
            }),
            install: this.formBuilder.group({
                maxInstallAttempts: [3, Validators.min(1)],
                installRetryInterval: [60, Validators.min(1)],
            }),
            profile: [""],
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
                maxRebootTries: [30, Validators.min(1)],
                rebootRetryInterval: [60, Validators.min(1)],
            }),
            snapshots: this.formBuilder.group({
                snapshotsLocation: ["assurance/snapshots/"],
                maxSnapshotTries: [3, Validators.min(1)],
                snapshotRetryInterval: [60, Validators.min(1)],
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
                commandTimeout: [120, Validators.min(1)],
                connectionTimeout: [30, Validators.min(1)],
            }),
        });
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Settings";
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
