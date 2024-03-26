// src/app/pages/inventory-details/inventory-details.ts

import { ActivatedRoute, Router } from "@angular/router";
import { Component, HostBinding, OnInit } from "@angular/core";
import {
    FirewallPlatform,
    PanoramaPlatform,
} from "../../shared/interfaces/platform.interface";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CommonModule } from "@angular/common";
import { ComponentPageHeader } from "../component-page-header/component-page-header";
import { ComponentPageTitle } from "../page-title/page-title";
import { Firewall } from "../../shared/interfaces/firewall.interface";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { Panorama } from "../../shared/interfaces/panorama.interface";

@Component({
    selector: "app-inventory-details",
    templateUrl: "./inventory-details.html",
    styleUrls: ["./inventory-details.scss"],
    standalone: true,
    imports: [
        CommonModule,
        ComponentPageHeader,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
    ],
})
export class InventoryDetailsComponent implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryItem: Firewall | Panorama | undefined;
    inventoryForm: FormGroup;
    firewallPlatforms: FirewallPlatform[] = [];
    panoramaPlatforms: PanoramaPlatform[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private inventoryService: InventoryService,
        private formBuilder: FormBuilder,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        // Update the form group
        this.inventoryForm = this.formBuilder.group({
            hostname: ["", Validators.required],
            ipv4Address: ["", Validators.required],
            ipv6Address: [""],
            platform: [""],
            notes: [""],
            ha: [false],
            haPeer: [""],
            inventoryType: [""],
        });
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory Details";
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.getInventoryItem(itemId);
        }

        this.inventoryForm
            .get("inventoryType")
            ?.valueChanges.subscribe((inventoryType) => {
                if (inventoryType === "firewall") {
                    this.fetchFirewallPlatforms();
                } else if (inventoryType === "panorama") {
                    this.fetchPanoramaPlatforms();
                }
            });
    }

    fetchFirewallPlatforms(): void {
        this.inventoryService.fetchFirewallPlatforms().subscribe(
            (platforms: FirewallPlatform[]) => {
                this.firewallPlatforms = platforms;
            },
            (error: any) => {
                console.error("Error fetching firewall platforms:", error);
            },
        );
    }

    fetchPanoramaPlatforms(): void {
        this.inventoryService.fetchPanoramaPlatforms().subscribe(
            (platforms: PanoramaPlatform[]) => {
                this.panoramaPlatforms = platforms;
            },
            (error: any) => {
                console.error("Error fetching panorama platforms:", error);
            },
        );
    }

    getInventoryItem(itemId: string): void {
        this.inventoryService.getInventoryItem(itemId).subscribe(
            (item: Firewall | Panorama) => {
                this.inventoryItem = item;
                this.inventoryForm.patchValue(item);
            },
            (error: any) => {
                console.error("Error fetching inventory item:", error);
            },
        );
    }

    updateInventoryItem(): void {
        if (this.inventoryItem && this.inventoryForm.valid) {
            const updatedItem = {
                ...this.inventoryItem,
                ...this.inventoryForm.value,
            };
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

    deleteInventoryItem(): void {
        if (this.inventoryItem) {
            this.inventoryService
                .deleteInventoryItem(this.inventoryItem.uuid)
                .subscribe(
                    () => {
                        this.router.navigate(["/inventory"]);
                    },
                    (error) => {
                        console.error("Error deleting inventory item:", error);
                    },
                );
        }
    }
}
