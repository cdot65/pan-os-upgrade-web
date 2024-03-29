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
import { DeleteDialogComponent } from "../confirmation-dialog/delete-dialog";
import { InventoryItem } from "../../shared/interfaces/inventory-item.interface";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryPlatform } from "src/app/shared/interfaces/inventory-platform.interface";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";

@Component({
    selector: "app-inventory-details",
    templateUrl: "./inventory-details.html",
    styleUrls: ["./inventory-details.scss"],
    standalone: true,
    imports: [
        CommonModule,
        InventoryPageHeader,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
    ],
})
/**
 * Represents the component for displaying and managing inventory details.
 */
export class InventoryDetailsComponent implements OnInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryItem: InventoryItem | undefined;
    inventoryForm: FormGroup;
    firewallPlatforms: InventoryPlatform[] = [];
    panoramaPlatforms: InventoryPlatform[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private inventoryService: InventoryService,
        private formBuilder: FormBuilder,
        private dialog: MatDialog,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        // Update the form group
        this.inventoryForm = this.formBuilder.group({
            // author: localStorage.getItem("author"),
            deviceGroup: [""],
            deviceType: [""],
            ha: [false],
            haPeer: [""],
            hostname: ["", Validators.required],
            ipv4Address: ["", Validators.required],
            ipv6Address: [""],
            notes: [""],
            panoramaAppliance: [""],
            panoramaManaged: [false],
            platformName: ["", Validators.required],
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
        // console.log(localStorage.getItem("author"));
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.getInventoryItem(itemId);
        }

        this.inventoryForm
            .get("deviceType")
            ?.valueChanges.subscribe((deviceType) => {
                if (deviceType === "Firewall") {
                    this.fetchFirewallPlatforms();
                    this.inventoryForm.get("deviceGroup")?.setValidators([]);
                    this.inventoryForm
                        .get("panoramaAppliance")
                        ?.setValidators([]);
                    this.inventoryForm
                        .get("panoramaManaged")
                        ?.setValidators([]);
                } else if (deviceType === "Panorama") {
                    this.fetchPanoramaPlatforms();
                    this.inventoryForm.get("deviceGroup")?.clearValidators();
                    this.inventoryForm
                        .get("panoramaAppliance")
                        ?.clearValidators();
                    this.inventoryForm
                        .get("panoramaManaged")
                        ?.clearValidators();
                }
                this.inventoryForm.get("deviceGroup")?.updateValueAndValidity();
                this.inventoryForm
                    .get("panoramaAppliance")
                    ?.updateValueAndValidity();
                this.inventoryForm
                    .get("panoramaManaged")
                    ?.updateValueAndValidity();
            });
    }

    /**
     * Fetches the firewall platforms from the inventory service.
     */
    fetchFirewallPlatforms(): void {
        this.inventoryService.fetchFirewallPlatforms().subscribe(
            (platforms: InventoryPlatform[]) => {
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
    fetchPanoramaPlatforms(): void {
        this.inventoryService.fetchPanoramaPlatforms().subscribe(
            (platforms: InventoryPlatform[]) => {
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
    getInventoryItem(itemId: string): void {
        this.inventoryService.getInventoryItem(itemId).subscribe(
            (item: InventoryItem) => {
                this.inventoryItem = item;
                this.inventoryForm.patchValue(item);
                console.log("inventoryItem: ", this.inventoryItem);
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
    updateInventoryItem(): void {
        if (this.inventoryItem && this.inventoryForm.valid) {
            const updatedItem = {
                ...this.inventoryItem,
                ...this.inventoryForm.value,
            };
            if (updatedItem.deviceType === "Panorama") {
                delete updatedItem.deviceGroup;
                delete updatedItem.panoramaAppliance;
                delete updatedItem.panoramaManaged;
            }
            console.log("updatedItem", updatedItem);
            this.inventoryService
                .updateInventoryItem(updatedItem, this.inventoryItem.uuid)
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
     * Deletes the inventory item.
     */
    deleteInventoryItem(): void {
        if (this.inventoryItem) {
            const dialogRef = this.dialog.open(DeleteDialogComponent, {
                width: "300px",
                data: {
                    title: "Confirm Delete",
                    message:
                        "Are you sure you want to delete this inventory item?",
                },
            });

            dialogRef.afterClosed().subscribe((result: boolean) => {
                if (result) {
                    this.inventoryService
                        .deleteInventoryItem(this.inventoryItem!.uuid)
                        .subscribe(
                            () => {
                                this.router.navigate(["/inventory"]);
                            },
                            (error) => {
                                console.error(
                                    "Error deleting inventory item:",
                                    error,
                                );
                            },
                        );
                }
            });
        }
    }

    onCancel(): void {
        this.inventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }
}
