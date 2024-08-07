/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/inventory-create/inventory-create.facade.ts

import { Injectable } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { BehaviorSubject, Observable } from "rxjs";
import { CookieService } from "ngx-cookie-service";
import { InventoryService } from "../../shared/services/inventory.service";
import { Device } from "../../shared/interfaces/device.interface";
import { DeviceType } from "../../shared/interfaces/device-type.interface";
import { InventoryCreateProcessorService } from "./inventory-create-processor.service";
import { InventoryCreateConfig } from "./inventory-create.config";

@Injectable()
export class InventoryCreateFacade {
    private devices$ = new BehaviorSubject<Device[]>([]);
    private firewallPlatforms$ = new BehaviorSubject<DeviceType[]>([]);
    private panoramaPlatforms$ = new BehaviorSubject<DeviceType[]>([]);

    createInventoryForm: FormGroup;

    constructor(
        private cookieService: CookieService,
        private formBuilder: FormBuilder,
        private inventoryService: InventoryService,
        private router: Router,
        private processor: InventoryCreateProcessorService,
    ) {
        this.createInventoryForm = this.formBuilder.group({
            app_version: [""],
            device_group: [""],
            device_type: ["Firewall", Validators.required],
            ha_enabled: [false],
            hostname: ["", Validators.required],
            ipv4_address: [
                "",
                [Validators.pattern(InventoryCreateConfig.ipv4Pattern)],
            ],
            ipv6_address: [
                "",
                [Validators.pattern(InventoryCreateConfig.ipv6Pattern)],
            ],
            local_state: [""],
            notes: [""],
            panorama_appliance_id: [""],
            panorama_ipv4_address: [
                "",
                [Validators.pattern(InventoryCreateConfig.ipv4Pattern)],
            ],
            panorama_ipv6_address: [
                "",
                [Validators.pattern(InventoryCreateConfig.ipv6Pattern)],
            ],
            panorama_managed: [false],
            peer_device: [""],
            peer_ip: [""],
            peer_state: [""],
            platform_name: ["", Validators.required],
            serial: [""],
            sw_version: [""],
        });

        this.createInventoryForm.setValidators(
            this.processor.requireIpAddress(),
        );

        this.createInventoryForm
            .get("device_type")
            ?.valueChanges.subscribe((device_type) => {
                if (device_type === "Firewall") {
                    this.getFirewallPlatforms();
                } else if (device_type === "Panorama") {
                    this.getPanoramaPlatforms();
                }
                this.processor.updateFormValidation(
                    this.createInventoryForm,
                    device_type,
                );
            });
    }

    getDevices(): void {
        this.inventoryService.getDevices().subscribe(
            (devices) => {
                this.devices$.next(devices);
            },
            (error) => {
                console.error("Error fetching devices:", error);
            },
        );
    }

    getFirewallPlatforms(): void {
        this.inventoryService.getFirewallPlatforms().subscribe(
            (platforms: DeviceType[]) => {
                this.firewallPlatforms$.next(platforms);
            },
            (error: any) => {
                console.error("Error fetching firewall platforms:", error);
            },
        );
    }

    getPanoramaPlatforms(): void {
        this.inventoryService.getPanoramaPlatforms().subscribe(
            (platforms: DeviceType[]) => {
                this.panoramaPlatforms$.next(platforms);
            },
            (error: any) => {
                console.error("Error fetching panorama platforms:", error);
            },
        );
    }

    createDevice(): Observable<any> {
        if (this.createInventoryForm.valid) {
            const author = this.cookieService.get("author");
            const formValue = this.createInventoryForm.value;
            formValue.author = author;

            if (formValue.device_type === "Panorama") {
                delete formValue.device_group;
                delete formValue.panorama_appliance_id;
                delete formValue.panorama_managed;
            }

            return this.inventoryService.createDevice(formValue);
        }
        return new Observable((observer) => observer.error("Form is invalid"));
    }

    onCancel(): void {
        this.createInventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }

    getDevices$(): Observable<Device[]> {
        return this.devices$.asObservable();
    }

    getFirewallPlatforms$(): Observable<DeviceType[]> {
        return this.firewallPlatforms$.asObservable();
    }

    getPanoramaPlatforms$(): Observable<DeviceType[]> {
        return this.panoramaPlatforms$.asObservable();
    }

    getConfig(): typeof InventoryCreateConfig {
        return InventoryCreateConfig;
    }
}
