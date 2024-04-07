/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/inventory-create/inventory-create.ts

import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { DeviceType } from "../../shared/interfaces/device-type.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-inventory-create",
    templateUrl: "./inventory-create.html",
    styleUrls: ["./inventory-create.scss"],
    standalone: true,
    imports: [
        CommonModule,
        Footer,
        InventoryPageHeader,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        ReactiveFormsModule,
    ],
})
export class InventoryCreateComponent implements OnDestroy, OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    createInventoryForm: FormGroup;
    firewallPlatforms: DeviceType[] = [];
    panoramaPlatforms: DeviceType[] = [];
    private destroy$ = new Subject<void>();

    constructor(
        private formBuilder: FormBuilder,
        private inventoryService: InventoryService,
        private router: Router,
        private snackBar: MatSnackBar,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.createInventoryForm = this.formBuilder.group({
            author: localStorage.getItem("author"),
            device_group: [""],
            device_type: ["Firewall", Validators.required],
            ha: [false],
            ha_mode: [""],
            ha_peer: [""],
            ha_status: [""],
            hostname: ["", Validators.required],
            ipv4_address: ["", Validators.required],
            ipv6_address: [""],
            notes: [""],
            panorama_appliance: [""],
            panorama_ipv4_address: [""],
            panorama_ipv6_address: [""],
            panorama_managed: [false],
            platform_name: ["", Validators.required],
        });
    }

    createDevice(): void {
        if (this.createInventoryForm && this.createInventoryForm.valid) {
            const formValue = this.createInventoryForm.value;
            if (formValue.device_type === "Panorama") {
                delete formValue.device_group;
                delete formValue.panorama_appliance;
                delete formValue.panorama_managed;
            }
            this.inventoryService
                .createDevice(formValue)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    () => {
                        this.router.navigate(["/inventory"]);
                    },
                    (error) => {
                        console.error("Error creating inventory item:", error);
                        this.snackBar.open(
                            "Failed to create inventory item. Please try again.",
                            "Close",
                            {
                                duration: 3000,
                            },
                        );
                    },
                );
        }
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
        this._componentPageTitle.title = "Inventory Create";
        this.getFirewallPlatforms();

        this.createInventoryForm
            .get("device_type")
            ?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((device_type) => {
                if (device_type === "Firewall") {
                    this.getFirewallPlatforms();
                } else if (device_type === "Panorama") {
                    this.getPanoramaPlatforms();
                }
                this.updateFormValidation(device_type);
            });
    }

    onCancel(): void {
        this.createInventoryForm.reset();
        this.router.navigate(["/inventory"]);
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
}
