// src/app/pages/inventory-create/inventory-create.ts

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
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { Router } from "@angular/router";

@Component({
    selector: "app-inventory-create",
    templateUrl: "./inventory-create.html",
    styleUrls: ["./inventory-create.scss"],
    standalone: true,
    imports: [
        CommonModule,
        ComponentPageHeader,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
})
export class InventoryCreateComponent implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryForm: FormGroup;
    firewallPlatforms: FirewallPlatform[] = [];
    panoramaPlatforms: PanoramaPlatform[] = [];

    constructor(
        private formBuilder: FormBuilder,
        private inventoryService: InventoryService,
        private router: Router,
    ) {
        this.inventoryForm = this.formBuilder.group({
            hostname: ["", Validators.required],
            ipv4Address: ["", Validators.required],
            ipv6Address: [""],
            platform: ["", Validators.required],
            notes: [""],
            ha: [false],
            haPeer: [""],
            inventoryType: ["", Validators.required],
        });
    }

    ngOnInit(): void {
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

    createInventoryItem(): void {
        if (this.inventoryForm.valid) {
            this.inventoryService
                .createInventoryItem(this.inventoryForm.value)
                .subscribe(
                    () => {
                        this.router.navigate(["/inventory"]);
                    },
                    (error) => {
                        console.error("Error creating inventory item:", error);
                    },
                );
        }
    }
}
