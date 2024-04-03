/* eslint-disable @typescript-eslint/naming-convention */
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
            device_group: [""],
            device_type: ["Firewall", Validators.required],
            ha: [false],
            ha_peer: [""],
            hostname: ["", Validators.required],
            ipv4_address: ["", Validators.required],
            ipv6_address: [""],
            notes: [""],
            panorama_appliance: [""],
            panorama_managed: [false],
            platform_name: ["", Validators.required],
        });
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory Create";
        this.getFirewallPlatforms();

        this.createInventoryForm
            .get("device_type")
            ?.valueChanges.subscribe((device_type) => {
                if (device_type === "Firewall") {
                    this.getFirewallPlatforms();
                } else if (device_type === "Panorama") {
                    this.getPanoramaPlatforms();
                }
                this.updateFormValidation(device_type);
            });
    }

    updateFormValidation(device_type: string): void {
        const device_groupControl =
            this.createInventoryForm.get("device_group");
        const panorama_applianceControl =
            this.createInventoryForm.get("panorama_appliance");
        const panorama_managedControl =
            this.createInventoryForm.get("panorama_managed");

        if (device_type === "Firewall") {
            device_groupControl?.setValidators([]);
            panorama_applianceControl?.setValidators([]);
            panorama_managedControl?.setValidators([]);
        } else if (device_type === "Panorama") {
            device_groupControl?.clearValidators();
            panorama_applianceControl?.clearValidators();
            panorama_managedControl?.clearValidators();
        }

        device_groupControl?.updateValueAndValidity();
        panorama_applianceControl?.updateValueAndValidity();
        panorama_managedControl?.updateValueAndValidity();
    }

    getFirewallPlatforms(): void {
        this.inventoryService.getFirewallPlatforms().subscribe(
            (platforms: InventoryPlatform[]) => {
                this.firewallPlatforms = platforms;
            },
            (error: any) => {
                console.error("Error fetching firewall platforms:", error);
            },
        );
    }

    getPanoramaPlatforms(): void {
        this.inventoryService.getPanoramaPlatforms().subscribe(
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
            if (formValue.device_type === "Panorama") {
                delete formValue.device_group;
                delete formValue.panorama_appliance;
                delete formValue.panorama_managed;
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
