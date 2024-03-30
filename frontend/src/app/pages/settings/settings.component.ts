// src/app/pages/settings/settings.component.ts

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
import { MatSliderModule } from "@angular/material/slider";
import { Settings } from "../../shared/interfaces/settings.interface";

@Component({
    selector: "app-settings",
    templateUrl: "./settings.component.html",
    styleUrls: ["./settings.component.scss"],
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
        MatRadioModule,
        MatSliderModule,
    ],
})
export class SettingsComponent implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    settingsForm: FormGroup;

    constructor(
        private formBuilder: FormBuilder,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.settingsForm = this.formBuilder.group({
            concurrency: this.formBuilder.group({
                threads: [10, Validators.min(1)],
            }),
            download: this.formBuilder.group({
                maxTries: [3, Validators.min(1)],
                retryInterval: [60, Validators.min(1)],
            }),
            install: this.formBuilder.group({
                maxTries: [3, Validators.min(1)],
                retryInterval: [60, Validators.min(1)],
            }),
            logging: this.formBuilder.group({
                filePath: ["logs/upgrade.log"],
                level: ["INFO"],
                maxSize: [10, Validators.min(1)],
                upgradeLogCount: [10, Validators.min(1)],
            }),
            readinessChecks: this.formBuilder.group({
                checks: this.formBuilder.group({
                    activeSupport: [true],
                    arpEntryExist: [false],
                    candidateConfig: [true],
                    certificatesRequirements: [false],
                    contentVersion: [true],
                    dynamicUpdates: [true],
                    expiredLicenses: [true],
                    freeDiskSpace: [true],
                    ha: [true],
                    ipSecTunnelStatus: [true],
                    jobs: [false],
                    ntpSync: [false],
                    panorama: [true],
                    planesClockSync: [true],
                    sessionExist: [false],
                }),
                customize: [true],
                disabled: [false],
                location: ["assurance/readiness_checks/"],
            }),
            reboot: this.formBuilder.group({
                maxTries: [30, Validators.min(1)],
                retryInterval: [60, Validators.min(1)],
            }),
            snapshots: this.formBuilder.group({
                customize: [true],
                disabled: [false],
                location: ["assurance/snapshots/"],
                maxTries: [3, Validators.min(1)],
                retryInterval: [60, Validators.min(1)],
                state: this.formBuilder.group({
                    arpTable: [false],
                    contentVersion: [true],
                    ipSecTunnels: [false],
                    license: [true],
                    nics: [true],
                    routes: [false],
                    sessionStats: [false],
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
        // Initialize the form with current settings values
        // TODO: Fetch current settings from the backend API and patch the form
    }

    onSubmit(): void {
        if (this.settingsForm.valid) {
            const settings: Settings = this.settingsForm.value;
            console.log("Settings saved:", settings);
            // TODO: Implement saving the settings to the backend API
        }
    }
}
