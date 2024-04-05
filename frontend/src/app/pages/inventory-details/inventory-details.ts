/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/inventory-details/inventory-details.ts

import { ActivatedRoute, Router } from "@angular/router";
import { Component, HostBinding, OnInit } from "@angular/core";
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
import { MatSelectModule } from "@angular/material/select";
import { ProfileDialogComponent } from "../profile-select-dialog/profile-select-dialog.component";

@Component({
    selector: "app-inventory-details",
    templateUrl: "./inventory-details.html",
    styleUrls: ["./inventory-details.scss"],
    standalone: true,
    imports: [
        CommonModule,
        InventoryPageHeader,
        Footer,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        ReactiveFormsModule,
    ],
})

/**
 * Represents the component for displaying and managing inventory details.
 */
export class InventoryDetailsComponent implements OnInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryItem: Device | undefined;
    updateInventoryForm: FormGroup;
    firewallPlatforms: DeviceType[] = [];
    panoramaPlatforms: DeviceType[] = [];

    constructor(
        private formBuilder: FormBuilder,
        private dialog: MatDialog,
        private inventoryService: InventoryService,
        private route: ActivatedRoute,
        private router: Router,
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

    /**
     * Initializes the component.
     * Sets the page title to "Inventory Details".
     * Retrieves the inventory item based on the provided ID.
     * Subscribe to changes of inventory type form control and fetches the corresponding platforms.
     */
    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory Details";
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.getDevice(itemId);
        }

        this.updateInventoryForm
            .get("device_type")
            ?.valueChanges.subscribe((device_type) => {
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

    /**
     * Fetches the firewall platforms from the inventory service.
     */
    getFirewallPlatforms(): void {
        this.inventoryService.getFirewallPlatforms().subscribe(
            (platforms: DeviceType[]) => {
                this.firewallPlatforms = platforms;
            },
            (error: any) => {
                console.error("Error fetching firewall platforms:", error);
            },
        );
    }

    /**
     * Fetches the Panorama platforms from the inventory service.
     */
    getPanoramaPlatforms(): void {
        this.inventoryService.getPanoramaPlatforms().subscribe(
            (platforms: DeviceType[]) => {
                this.panoramaPlatforms = platforms;
            },
            (error: any) => {
                console.error("Error fetching panorama platforms:", error);
            },
        );
    }

    /**
     * Retrieves an inventory item by its ID.
     *
     * @param itemId - The ID of the inventory item to retrieve.
     */
    getDevice(itemId: string): void {
        this.inventoryService.getDevice(itemId).subscribe(
            (item: Device) => {
                this.inventoryItem = item;
                this.updateInventoryForm.patchValue(item);
            },
            (error: any) => {
                console.error("Error fetching inventory item:", error);
            },
        );
    }

    /**
     * Updates the inventory item with the values from the inventory form.
     * Navigates to the inventory page after successful update.
     * Logs an error if the update fails.
     */
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
                .subscribe(
                    () => {
                        this.router.navigate(["/inventory"]);
                    },
                    (error) => {
                        console.error("Error updating inventory item:", error);
                    },
                );
        }
    }

    /**
     * Resets the updateInventoryForm and navigates to the inventory page.
     */
    onCancel(): void {
        this.updateInventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }

    refreshDeviceDetails(): void {
        const dialogRef = this.dialog.open(ProfileDialogComponent, {
            width: "400px",
            data: { message: "Select a profile to refresh device details" },
        });

        dialogRef.afterClosed().subscribe((selectedProfileUuid) => {
            if (selectedProfileUuid && this.inventoryItem) {
                const author = localStorage.getItem("author");
                const refreshForm = {
                    author: author ? parseInt(author, 10) : 0,
                    device: this.inventoryItem.uuid,
                    profile: selectedProfileUuid,
                };
                this.inventoryService.refreshDevice(refreshForm).subscribe(
                    (updatedItem: Device | null) => {
                        if (updatedItem) {
                            this.inventoryItem = updatedItem;
                            this.updateInventoryForm.patchValue(updatedItem);
                            // Show a success toast or message
                        } else {
                            // Show an error toast or message
                        }
                    },
                    (error) => {
                        console.error(
                            "Error refreshing device details:",
                            error,
                        );
                        // Show an error toast or message
                    },
                );
            }
        });
    }
}
