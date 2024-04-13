/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/inventory-create/inventory-create.ts

import {
    AbstractControl,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from "@angular/forms";
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { Device } from "../../shared/interfaces/device.interface";
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
    devices: Device[] = [];
    haStates: string[] = [
        "active",
        "passive",
        "active-primary",
        "active-secondary",
    ];
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
            app_version: [""],
            device_group: [""],
            device_type: ["Firewall", Validators.required],
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
            panorama_appliance: [""],
            panorama_ipv4_address: [
                "",
                [
                    Validators.pattern(
                        // eslint-disable-next-line max-len
                        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
                    ),
                ],
            ],
            panorama_ipv6_address: [
                "",
                [
                    Validators.pattern(
                        // eslint-disable-next-line max-len
                        /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,
                    ),
                ],
            ],
            panorama_managed: [false],
            peer_device: [""],
            peer_ip: [""],
            peer_state: [""],
            platform_name: ["", Validators.required],
            serial: [""],
            sw_version: [""],
        });
    }

    createDevice(): void {
        if (this.createInventoryForm && this.createInventoryForm.valid) {
            const author = localStorage.getItem("author");
            const formValue = this.createInventoryForm.value;
            formValue.author = author;

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
        this.getDevices();
        this.getFirewallPlatforms();
        this.createInventoryForm.setValidators(this.requireIpAddress());
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

    requireIpAddress(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const ipv4Control = control.get("ipv4_address");
            const ipv6Control = control.get("ipv6_address");
            const panoramaManagedControl = control.get("panorama_managed");
            const panoramaIpv4Control = control.get("panorama_ipv4_address");
            const panoramaIpv6Control = control.get("panorama_ipv6_address");

            if (
                (ipv4Control && ipv4Control.value && ipv4Control.invalid) ||
                (ipv6Control && ipv6Control.value && ipv6Control.invalid)
            ) {
                return { invalidIpAddress: true };
            }

            if (!ipv4Control?.value && !ipv6Control?.value) {
                return { requireIpAddress: true };
            }

            if (panoramaManagedControl?.value) {
                if (
                    (panoramaIpv4Control &&
                        panoramaIpv4Control.value &&
                        panoramaIpv4Control.invalid) ||
                    (panoramaIpv6Control &&
                        panoramaIpv6Control.value &&
                        panoramaIpv6Control.invalid)
                ) {
                    return { invalidPanoramaIpAddress: true };
                }

                if (
                    !panoramaIpv4Control?.value &&
                    !panoramaIpv6Control?.value
                ) {
                    return { requirePanoramaIpAddress: true };
                }
            }

            return null;
        };
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
