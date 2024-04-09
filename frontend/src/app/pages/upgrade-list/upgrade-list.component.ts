/* eslint-disable @typescript-eslint/naming-convention */
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { ComponentPageTitle } from "../page-title/page-title";
import { Device } from "../../shared/interfaces/device.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatStepperModule } from "@angular/material/stepper";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { STEPPER_GLOBAL_OPTIONS } from "@angular/cdk/stepper";
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
        MatStepperModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
        MatCardModule,
    ],
    providers: [
        {
            provide: STEPPER_GLOBAL_OPTIONS,
            useValue: { showError: true },
        },
    ],
})
export class UpgradeListComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    devices: Device[] = [];
    profiles: Profile[] = [];
    upgradeForm: FormGroup;
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
            profile: ["", Validators.required],
            targetVersion: [""],
            scheduledAt: [""],
        });
    }

    getDevice(deviceId: string): Device | undefined {
        return this.devices.find((d) => d.uuid === deviceId);
    }

    getDeviceHaMode(deviceId: string): string | null {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.ha_mode : null;
    }

    getDeviceHaPeer(deviceId: string): string | null {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.ha_peer : null;
    }

    getDeviceHaProperties(deviceId: string): {
        ha: boolean;
        ha_mode: string | null;
        ha_peer: string | null;
        ha_status: string | null;
    } {
        const device = this.devices.find((d) => d.uuid === deviceId);
        if (device) {
            return {
                ha: device.ha,
                ha_mode: device.ha_mode,
                ha_peer: device.ha_peer,
                ha_status: device.ha_status,
            };
        } else {
            return {
                ha: false,
                ha_mode: null,
                ha_peer: null,
                ha_status: null,
            };
        }
    }

    getDeviceHaStatus(deviceId: string): string | null {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.ha_status : null;
    }

    getDeviceHostname(deviceId: string): string {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.hostname : "";
    }

    getDeviceSwVersion(deviceId: string): string {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.sw_version : "";
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
        return device ? device.ha : false;
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
                profile: this.upgradeForm.get("profile")?.value,
                targetVersion: this.upgradeForm.get("targetVersion")?.value,
            };

            this.upgradeService
                .upgradeDevice(upgradeFormData)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    (jobId) => {
                        if (jobId) {
                            this.snackBar.open(
                                "Upgrade initiated successfully. Job ID: " +
                                    jobId,
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                            this.router.navigate(["/upgrade-status", jobId]);
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
        }
    }
}
