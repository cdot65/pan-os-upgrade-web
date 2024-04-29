/* eslint-disable @typescript-eslint/naming-convention */
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";
import {
    UpgradeJob,
    UpgradeResponse,
} from "../../shared/interfaces/upgrade-response.interface";

import { ComponentPageTitle } from "../page-title/page-title";
import { Device } from "../../shared/interfaces/device.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatRadioModule } from "@angular/material/radio";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { UpgradeForm } from "../../shared/interfaces/upgrade-form.interface";
import { UpgradePageHeader } from "../upgrade-page-header/upgrade-page-header";
import { UpgradeService } from "../../shared/services/upgrade.service";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-upgrade-list",
    templateUrl: "./upgrade-list.component.html",
    styleUrls: ["./upgrade-list.component.scss"],
    standalone: true,
    imports: [
        Footer,
        UpgradePageHeader,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatSelectModule,
        MatButtonModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
        MatCardModule,
        MatProgressBarModule,
        MatRadioModule,
    ],
})
export class UpgradeListComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    devices: Device[] = [];
    profiles: Profile[] = [];
    upgradeForm: FormGroup;
    step = 0;
    target_versions: string[] = ["10.1.3", "10.2.9-h1", "11.1.1-h1"];
    upgradeJobs: UpgradeJob[] = [];
    private destroy$ = new Subject<void>();

    constructor(
        private inventoryService: InventoryService,
        private profileService: ProfileService,
        private upgradeService: UpgradeService,
        private router: Router,
        private snackBar: MatSnackBar,
        private formBuilder: FormBuilder,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.upgradeForm = this.formBuilder.group({
            devices: [[], Validators.required],
            dry_run: [true],
            profile: ["", Validators.required],
            target_version: ["", Validators.required],
            scheduledAt: [""],
        });
    }

    getDevice(deviceId: string): Device | undefined {
        return this.devices.find((d) => d.uuid === deviceId);
    }

    getDeviceHaProperties(deviceId: string): {
        ha_enabled: boolean;
        local_state: string | null;
        peer_ip: string | null;
        peer_state: string | null;
    } {
        const device = this.devices.find((d) => d.uuid === deviceId);
        if (device && device.ha_enabled) {
            return {
                ha_enabled: true,
                local_state: device.local_state || null,
                peer_ip: device.peer_ip || null,
                peer_state: device.peer_state || null,
            };
        } else {
            return {
                ha_enabled: false,
                local_state: "n/a",
                peer_ip: "n/a",
                peer_state: "n/a",
            };
        }
    }

    getDeviceHostname(deviceId: string): string {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.hostname : "";
    }

    getDeviceSwVersion(deviceId: string): string | null {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.sw_version : null;
    }

    getDevices(): void {
        this.inventoryService
            .getDevices()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (devices) => {
                    this.devices = devices.filter(
                        (device) => device.device_type === "Firewall",
                    );
                },
                (error) => {
                    console.error("Error fetching devices:", error);
                    this.snackBar.open(
                        "Failed to fetch devices. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    getProfileName(profileId: string): string {
        const profile = this.profiles.find((p) => p.uuid === profileId);
        return profile ? profile.name : "";
    }

    getProfiles(): void {
        this.profileService
            .getProfiles()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (profiles) => {
                    this.profiles = profiles;
                },
                (error) => {
                    console.error("Error fetching profiles:", error);
                    this.snackBar.open(
                        "Failed to fetch profiles. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    isDeviceHaEnabled(deviceId: string): boolean {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return !!device?.peer_device_id;
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Upgrade List";
        this.getDevices();
        this.getProfiles();
    }

    onUpgradeClick(): void {
        if (this.upgradeForm.valid) {
            const upgradeFormData: UpgradeForm = {
                author: 1, // Replace with the actual author ID
                devices: this.upgradeForm.get("devices")?.value,
                dry_run: this.upgradeForm.get("dry_run")?.value,
                profile: this.upgradeForm.get("profile")?.value,
                target_version: this.upgradeForm.get("target_version")?.value,
            };

            this.upgradeService
                .upgradeDevice(upgradeFormData)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    (response: UpgradeResponse | null) => {
                        if (response && response.upgrade_jobs) {
                            this.upgradeJobs = response.upgrade_jobs;
                            this.snackBar.open(
                                "Upgrade initiated successfully.",
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                        } else {
                            this.snackBar.open(
                                "Failed to initiate the upgrade. Please try again.",
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                        }
                    },
                    (error) => {
                        console.error("Error upgrading device:", error);
                        this.snackBar.open(
                            "Failed to initiate the upgrade. Please try again.",
                            "Close",
                            {
                                duration: 3000,
                            },
                        );
                    },
                );

            this.step = 4;
        }
    }

    resetForm() {
        this.step = 0;
        this.upgradeForm.reset();
        this.upgradeJobs = [];
    }

    trackByJobId(index: number, job: UpgradeJob): string {
        return job.job;
    }
}
