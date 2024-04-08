// src/app/pages/upgrade-list/upgrade-list.component.ts

import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";

import { ComponentPageTitle } from "../page-title/page-title";
import { Device } from "../../shared/interfaces/device.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTableModule } from "@angular/material/table";
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
        MatCheckboxModule,
        MatFormFieldModule,
        MatTableModule,
        MatIconModule,
        MatButtonModule,
        MatSelectModule,
    ],
})
export class UpgradeListComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    devices: Device[] = [];
    profiles: Profile[] = [];
    selectedDevice: Device | null = null;
    selectedProfile: Profile | null = null;
    private destroy$ = new Subject<void>();

    constructor(
        private inventoryService: InventoryService,
        private profileService: ProfileService,
        private upgradeService: UpgradeService,
        private router: Router,
        private snackBar: MatSnackBar,
        private dialog: MatDialog,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    ngOnInit(): void {
        this._componentPageTitle.title = "Upgrade List";
        this.getDevices();
        this.getProfiles();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
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

    onDeviceSelect(device: Device): void {
        this.selectedDevice = device;
    }

    onProfileSelect(profile: Profile): void {
        this.selectedProfile = profile;
    }

    onUpgradeClick(): void {
        if (!this.selectedDevice) {
            this.snackBar.open("Please select a device to upgrade.", "Close", {
                duration: 3000,
            });
            return;
        }

        if (!this.selectedProfile) {
            this.snackBar.open("Please select a profile.", "Close", {
                duration: 3000,
            });
            return;
        }

        const upgradeForm: UpgradeForm = {
            author: 1, // Replace with the actual author ID
            device: this.selectedDevice.uuid,
            profile: this.selectedProfile.uuid,
        };

        this.upgradeService
            .upgradeDevice(upgradeForm)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (jobId) => {
                    if (jobId) {
                        this.snackBar.open(
                            "Upgrade initiated successfully. Job ID: " + jobId,
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
