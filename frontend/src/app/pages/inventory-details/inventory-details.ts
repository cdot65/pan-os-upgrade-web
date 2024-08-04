/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/inventory-details/inventory-details.ts

import {
    AbstractControl,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { CookieService } from "ngx-cookie-service";
import { Device } from "../../shared/interfaces/device.interface";
import { DeviceType } from "src/app/shared/interfaces/device-type.interface";
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
    devices: Device[] = [];
    firewallPlatforms: DeviceType[] = [];
    haStates: string[] = [
        "active",
        "passive",
        "active-primary",
        "active-secondary",
    ];
    inventoryItem: Device | undefined;
    jobId: string | null = null;
    panoramaPlatforms: DeviceType[] = [];
    panoramas: Device[] = [];
    refreshJobCompleted: boolean = false;
    showRefreshError: boolean = false;
    showRefreshProgress: boolean = false;
    updateInventoryForm: FormGroup;
    private destroy$ = new Subject<void>();
    private retryCount = 0;

    constructor(
        private cookieService: CookieService,
        private dialog: MatDialog,
        private formBuilder: FormBuilder,
        private inventoryService: InventoryService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MatSnackBar,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.updateInventoryForm = this.formBuilder.group({
            app_version: [""],
            device_group: [""],
            device_type: [""],
            ha_enabled: [false],
            hostname: ["", Validators.required],
            ipv4_address: [
                "",
                [
                    Validators.pattern(
                        // eslint-disable-next-line max-len
                        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
                    ),
                ],
            ],
            ipv6_address: [
                "",
                [
                    Validators.pattern(
                        // eslint-disable-next-line max-len
                        /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
                    ),
                ],
            ],
            local_state: [""],
            notes: [""],
            panorama_appliance_id: [""],
            panorama_managed: [false],
            peer_device_id: [""],
            peer_ip: [""],
            peer_state: [""],
            platform_name: ["", Validators.required],
            serial: [""],
            sw_version: [""],
        });
    }

    /**
     * Retrieves a device from the inventory service based on the given item ID.
     *
     * @param itemId - The ID of the item to retrieve.
     * @return
     */
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

    /**
     * Retrieves the devices using the inventory service.
     *
     * @returns
     */
    getDevices(): void {
        this.inventoryService
            .getDevices()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (devices) => {
                    this.devices = devices;
                },
                (error) => {
                    console.error("Error fetching devices:", error);
                },
            );
    }

    /**
     * Retrieves the Panorama appliances from the inventory service and filters them.
     *
     * @returns
     */
    getPanoramaAppliances(): void {
        this.inventoryService
            .getDevices()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (panoramas) => {
                    this.panoramas = panoramas.filter(
                        (panorama) => panorama.device_type === "Panorama",
                    );
                },
                (error) => {
                    console.error("Error fetching devices:", error);
                },
            );
    }

    /**
     * Fetches the firewall platforms from the inventory service and assigns the result to the `firewallPlatforms` property.
     *
     * @return
     */
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

    /**
     * Retrieves the current status of the job.
     *
     * @returns
     */
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

    /**
     * Fetches panorama platforms from the inventory service and assigns them to the panoramaPlatforms property.
     *
     * @returns
     */
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

    /**
     * Executes the necessary cleanup operations when the component is destroyed.
     *
     * @return
     */
    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Initializes the component.
     *
     * - Sets the page title to "Inventory Details".
     * - Retrieves the list of devices.
     * - Retrieves the list of panorama appliances.
     * - If an `id` parameter is present in the route snapshot, retrieves the device with that id.
     * - Sets validators for the `updateInventoryForm` based on the selected `device_type`.
     * - Sets up value change listeners for the `device_type` form control.
     * - Updates the validity of the `device_group`, `panorama_appliance_id`, and `panorama_managed` form controls.
     *
     * @return
     */
    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory Details";
        this.getDevices();
        this.getPanoramaAppliances();
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.getDevice(itemId);
        }
        this.updateInventoryForm.setValidators(this.requireIpAddress());

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
                        .get("panorama_appliance_id")
                        ?.setValidators([]);
                    this.updateInventoryForm
                        .get("panorama_managed")
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
                        .get("panorama_appliance_id")
                        ?.clearValidators();
                    this.updateInventoryForm
                        .get("panorama_managed")
                        ?.clearValidators();
                }
                this.updateInventoryForm
                    .get("device_group")
                    ?.updateValueAndValidity();
                this.updateInventoryForm
                    .get("panorama_appliance_id")
                    ?.updateValueAndValidity();
                this.updateInventoryForm
                    .get("panorama_managed")
                    ?.updateValueAndValidity();
            });
    }

    /**
     * Resets the inventory form and navigates to the inventory page.
     *
     * @returns
     */
    onCancel(): void {
        this.updateInventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }

    /**
     * Opens a dialog to select a profile and refreshes device details based on the selected profile.
     * If a profile is selected and inventory item is available, an API call is made to refresh the device details.
     * Shows progress and error message if the refresh process fails.
     */
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
                    const author = this.cookieService.get("author");
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

    /**
     * Validates if at least one of the IP addresses (IPv4 or IPv6) is provided.
     *
     * @returns A ValidatorFn that validates the IP addresses.
     *
     * @param control - The AbstractControl object representing the form control being validated.
     *
     * @returns An object with validation errors if the IP addresses are invalid or missing, otherwise returns null.
     */
    requireIpAddress(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const ipv4Control = control.get("ipv4_address");
            const ipv6Control = control.get("ipv6_address");

            if (
                (ipv4Control && ipv4Control.value && ipv4Control.invalid) ||
                (ipv6Control && ipv6Control.value && ipv6Control.invalid)
            ) {
                return { invalidIpAddress: true };
            }

            if (!ipv4Control?.value && !ipv6Control?.value) {
                return { requireIpAddress: true };
            }

            return null;
        };
    }

    /**
     * Updates the device in the inventory.
     *
     * @returns
     */
    updateDevice(): void {
        if (this.inventoryItem && this.updateInventoryForm.valid) {
            const updatedItem = {
                ...this.inventoryItem,
                ...this.updateInventoryForm.value,
            };

            if (updatedItem.device_type === "Panorama") {
                delete updatedItem.device_group;
                delete updatedItem.panorama_appliance_id;
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
