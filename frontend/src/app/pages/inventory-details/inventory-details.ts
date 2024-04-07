/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/inventory-details/inventory-details.ts

import { ActivatedRoute, Router } from "@angular/router";
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { Device } from "../../shared/interfaces/device.interface";
import { DeviceType } from "src/app/shared/interfaces/device-type.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ProfileDialogComponent } from "../profile-select-dialog/profile-select-dialog.component";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-inventory-details",
    templateUrl: "./inventory-details.html",
    styleUrls: ["./inventory-details.scss"],
    standalone: true,
    imports: [
        CommonModule,
        Footer,
        InventoryPageHeader,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        ReactiveFormsModule,
    ],
})

/**
 * Represents the component for displaying and managing inventory details.
 */
export class InventoryDetailsComponent implements OnDestroy, OnInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    firewallPlatforms: DeviceType[] = [];
    inventoryItem: Device | undefined;
    jobId: string | null = null;
    panoramaPlatforms: DeviceType[] = [];
    refreshJobCompleted: boolean = false;
    showRefreshError: boolean = false;
    showRefreshProgress: boolean = false;
    updateInventoryForm: FormGroup;
    private destroy$ = new Subject<void>();
    private retryCount = 0;

    constructor(
        private dialog: MatDialog,
        private formBuilder: FormBuilder,
        private inventoryService: InventoryService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MatSnackBar,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        // Update the form group
        this.updateInventoryForm = this.formBuilder.group({
            // author: localStorage.getItem("author"),
            device_group: [""],
            device_type: [""],
            ha: [false],
            ha_mode: [""],
            ha_peer: [""],
            ha_status: [""],
            hostname: ["", Validators.required],
            ipv4_address: ["", Validators.required],
            ipv6_address: [""],
            notes: [""],
            panorama_appliance: [""],
            panorama_managed: [false],
            platform_name: ["", Validators.required],
        });
    }

    getDevice(itemId: string): void {
        this.inventoryService
            .getDevice(itemId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (item: Device) => {
                    this.inventoryItem = item;
                    this.updateInventoryForm.patchValue(item);
                },
                (error: any) => {
                    console.error("Error fetching inventory item:", error);
                    this.snackBar.open(
                        "Failed to fetch inventory item. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    getFirewallPlatforms(): void {
        this.inventoryService
            .getFirewallPlatforms()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (platforms: DeviceType[]) => {
                    this.firewallPlatforms = platforms;
                },
                (error: any) => {
                    console.error("Error fetching firewall platforms:", error);
                    this.snackBar.open(
                        "Failed to fetch firewall platforms. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    getJobStatus(): void {
        if (this.jobId) {
            this.inventoryService
                .getJobStatus(this.jobId)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    (response) => {
                        if (response.status === "completed") {
                            this.showRefreshProgress = false;
                            this.getDevice(this.inventoryItem!.uuid);
                            this.retryCount = 0; // Reset the retry count on success
                        } else {
                            setTimeout(() => this.getJobStatus(), 2000);
                        }
                    },
                    (error) => {
                        console.error("Error checking job status:", error);
                        if (error.status === 400 && this.retryCount < 3) {
                            this.retryCount++;
                            console.log(
                                `Retrying job status check (attempt ${this.retryCount})`,
                            );
                            setTimeout(() => this.getJobStatus(), 2000);
                        } else {
                            this.showRefreshProgress = false;
                            this.showRefreshError = true;
                            this.retryCount = 0;
                            this.snackBar.open(
                                "Failed to check job status. Please try again.",
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                        }
                    },
                );
        }
    }

    getPanoramaPlatforms(): void {
        this.inventoryService
            .getPanoramaPlatforms()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (platforms: DeviceType[]) => {
                    this.panoramaPlatforms = platforms;
                },
                (error: any) => {
                    console.error("Error fetching panorama platforms:", error);
                    this.snackBar.open(
                        "Failed to fetch panorama platforms. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory Details";
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.getDevice(itemId);
        }

        this.updateInventoryForm
            .get("device_type")
            ?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((device_type) => {
                if (device_type === "Firewall") {
                    this.getFirewallPlatforms();
                    this.updateInventoryForm
                        .get("device_group")
                        ?.setValidators([]);
                    this.updateInventoryForm
                        .get("panorama_appliance")
                        ?.setValidators([]);
                    this.updateInventoryForm
                        .get("panorama_managed")
                        ?.setValidators([]);
                } else if (device_type === "Panorama") {
                    this.getPanoramaPlatforms();
                    this.updateInventoryForm
                        .get("device_group")
                        ?.clearValidators();
                    this.updateInventoryForm
                        .get("panorama_appliance")
                        ?.clearValidators();
                    this.updateInventoryForm
                        .get("panorama_managed")
                        ?.clearValidators();
                }
                this.updateInventoryForm
                    .get("device_group")
                    ?.updateValueAndValidity();
                this.updateInventoryForm
                    .get("panorama_appliance")
                    ?.updateValueAndValidity();
                this.updateInventoryForm
                    .get("panorama_managed")
                    ?.updateValueAndValidity();
            });
    }

    onCancel(): void {
        this.updateInventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }

    refreshDeviceDetails(): void {
        const dialogRef = this.dialog.open(ProfileDialogComponent, {
            width: "400px",
            data: { message: "Select a profile to refresh device details" },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((selectedProfileUuid) => {
                if (selectedProfileUuid && this.inventoryItem) {
                    const author = localStorage.getItem("author");
                    const refreshForm = {
                        author: author ? parseInt(author, 10) : 0,
                        device: this.inventoryItem.uuid,
                        profile: selectedProfileUuid,
                    };
                    this.showRefreshProgress = true;
                    this.showRefreshError = false; // Reset the error state

                    // Insert a delay to allow the API to initialize the job
                    setTimeout(() => {
                        this.inventoryService
                            .refreshDevice(refreshForm)
                            .pipe(takeUntil(this.destroy$))
                            .subscribe(
                                (jobId) => {
                                    this.jobId = jobId;
                                    this.getJobStatus();
                                },
                                (error) => {
                                    console.error(
                                        "Error refreshing device details:",
                                        error,
                                    );
                                    this.showRefreshProgress = false;
                                    this.showRefreshError = true;
                                    this.snackBar.open(
                                        "Failed to refresh device details. Please try again.",
                                        "Close",
                                        {
                                            duration: 3000,
                                        },
                                    );
                                },
                            );
                    }, 2000);
                }
            });
    }

    updateDevice(): void {
        if (this.inventoryItem && this.updateInventoryForm.valid) {
            const updatedItem = {
                ...this.inventoryItem,
                ...this.updateInventoryForm.value,
            };
            if (updatedItem.device_type === "Panorama") {
                delete updatedItem.device_group;
                delete updatedItem.panorama_appliance;
                delete updatedItem.panoramaManaged;
            }
            this.inventoryService
                .updateDevice(updatedItem, this.inventoryItem.uuid)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    () => {
                        this.router.navigate(["/inventory"]);
                    },
                    (error) => {
                        console.error("Error updating inventory item:", error);
                        this.snackBar.open(
                            "Failed to update inventory item. Please try again.",
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
