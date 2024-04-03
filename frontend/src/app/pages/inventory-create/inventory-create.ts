// src/app/pages/inventory-create/inventory-create.ts

import { Component, HostBinding, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryPlatform } from "../../shared/interfaces/inventory-platform.interface";
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
        InventoryPageHeader,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        Footer,
    ],
})
export class InventoryCreateComponent implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    createInventoryForm: FormGroup;
    firewallPlatforms: InventoryPlatform[] = [];
    panoramaPlatforms: InventoryPlatform[] = [];

    constructor(
        private formBuilder: FormBuilder,
        private inventoryService: InventoryService,
        private router: Router,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.createInventoryForm = this.formBuilder.group({
            author: localStorage.getItem("author"),
            deviceGroup: [""],
            deviceType: ["Firewall", Validators.required],
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

    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory Create";
        this.fetchFirewallPlatforms();

        this.createInventoryForm
            .get("deviceType")
            ?.valueChanges.subscribe((deviceType) => {
                if (deviceType === "Firewall") {
                    this.fetchFirewallPlatforms();
                    this.createInventoryForm
                        .get("deviceGroup")
                        ?.setValidators([]);
                    this.createInventoryForm
                        .get("panoramaAppliance")
                        ?.setValidators([]);
                    this.createInventoryForm
                        .get("panoramaManaged")
                        ?.setValidators([]);
                } else if (deviceType === "Panorama") {
                    this.fetchPanoramaPlatforms();
                    this.createInventoryForm
                        .get("deviceGroup")
                        ?.clearValidators();
                    this.createInventoryForm
                        .get("panoramaAppliance")
                        ?.clearValidators();
                    this.createInventoryForm
                        .get("panoramaManaged")
                        ?.clearValidators();
                }
                this.createInventoryForm
                    .get("deviceGroup")
                    ?.updateValueAndValidity();
                this.createInventoryForm
                    .get("panoramaAppliance")
                    ?.updateValueAndValidity();
                this.createInventoryForm
                    .get("panoramaManaged")
                    ?.updateValueAndValidity();
            });
    }

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

    createInventoryItem(): void {
        if (this.createInventoryForm && this.createInventoryForm.valid) {
            const formValue = this.createInventoryForm.value;
            if (formValue.deviceType === "Panorama") {
                delete formValue.deviceGroup;
                delete formValue.panoramaAppliance;
                delete formValue.panoramaManaged;
            }
            this.inventoryService.createInventoryItem(formValue).subscribe(
                () => {
                    this.router.navigate(["/inventory"]);
                },
                (error) => {
                    console.error("Error creating inventory item:", error);
                },
            );
        }
    }

    onCancel(): void {
        this.createInventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }
}
