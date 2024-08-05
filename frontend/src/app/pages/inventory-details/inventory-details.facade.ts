/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/inventory-details/inventory-details.facade.ts

import { Injectable } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { BehaviorSubject, Observable } from "rxjs";
import { InventoryService } from "../../shared/services/inventory.service";
import { Device } from "../../shared/interfaces/device.interface";
import { DeviceType } from "../../shared/interfaces/device-type.interface";
import { InventoryDetailsProcessorService } from "./inventory-details-processor.service";
import { InventoryDetailsConfig } from "./inventory-details.config";
import { map } from "rxjs/operators";

@Injectable()
export class InventoryDetailsFacade {
    private devices$ = new BehaviorSubject<Device[]>([]);
    private firewallPlatforms$ = new BehaviorSubject<DeviceType[]>([]);
    private panoramaPlatforms$ = new BehaviorSubject<DeviceType[]>([]);
    private panoramas$ = new BehaviorSubject<Device[]>([]);
    private inventoryItem$ = new BehaviorSubject<Device | undefined>(undefined);

    updateInventoryForm: FormGroup;

    constructor(
        private formBuilder: FormBuilder,
        private inventoryService: InventoryService,
        private processor: InventoryDetailsProcessorService,
    ) {
        this.updateInventoryForm = this.createForm();
        this.setupFormListeners();
    }

    private createForm(): FormGroup {
        return this.formBuilder.group({
            app_version: [""],
            device_group: [""],
            device_type: [""],
            ha_enabled: [false],
            hostname: ["", Validators.required],
            ipv4_address: [
                "",
                [Validators.pattern(InventoryDetailsConfig.ipv4Pattern)],
            ],
            ipv6_address: [
                "",
                [Validators.pattern(InventoryDetailsConfig.ipv6Pattern)],
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

    private setupFormListeners(): void {
        this.updateInventoryForm.setValidators(
            this.processor.requireIpAddress(),
        );
        this.updateInventoryForm
            .get("device_type")
            ?.valueChanges.subscribe((deviceType) => {
                if (deviceType === "Firewall") {
                    this.getFirewallPlatforms();
                } else if (deviceType === "Panorama") {
                    this.getPanoramaPlatforms();
                }
                this.processor.updateFormValidation(
                    this.updateInventoryForm,
                    deviceType,
                );
            });
    }

    getDevice(itemId: string): void {
        this.inventoryService.getDevice(itemId).subscribe(
            (item: Device) => {
                this.inventoryItem$.next(item);
                this.updateInventoryForm.patchValue(item);
            },
            (error: any) =>
                console.error("Error fetching inventory item:", error),
        );
    }

    getDevices(): void {
        this.inventoryService.getDevices().subscribe(
            (devices) => this.devices$.next(devices),
            (error) => console.error("Error fetching devices:", error),
        );
    }

    getPanoramaAppliances(): void {
        this.inventoryService.getDevices().subscribe(
            (panoramas) =>
                this.panoramas$.next(
                    panoramas.filter(
                        (panorama) => panorama.device_type === "Panorama",
                    ),
                ),
            (error) => console.error("Error fetching devices:", error),
        );
    }

    getFirewallPlatforms(): void {
        this.inventoryService.getFirewallPlatforms().subscribe(
            (platforms: DeviceType[]) =>
                this.firewallPlatforms$.next(platforms),
            (error: any) =>
                console.error("Error fetching firewall platforms:", error),
        );
    }

    getPanoramaPlatforms(): void {
        this.inventoryService.getPanoramaPlatforms().subscribe(
            (platforms: DeviceType[]) =>
                this.panoramaPlatforms$.next(platforms),
            (error: any) =>
                console.error("Error fetching panorama platforms:", error),
        );
    }

    updateDevice(): Observable<any> {
        const inventoryItem = this.inventoryItem$.getValue();
        if (inventoryItem && this.updateInventoryForm.valid) {
            const updatedItem = {
                ...inventoryItem,
                ...this.updateInventoryForm.value,
            };

            if (updatedItem.device_type === "Panorama") {
                delete updatedItem.device_group;
                delete updatedItem.panorama_appliance_id;
                delete updatedItem.panoramaManaged;
            }

            return this.inventoryService.updateDevice(
                updatedItem,
                inventoryItem.uuid,
            );
        }
        return new Observable((observer) =>
            observer.error("Form is invalid or inventory item is missing"),
        );
    }

    refreshDevice(refreshForm: any): Observable<string> {
        return this.inventoryService.refreshDevice(refreshForm).pipe(
            map((jobId) => {
                if (jobId === null) {
                    throw new Error("Job ID is null");
                }
                return jobId;
            }),
        );
    }

    getJobStatus(jobId: string): Observable<any> {
        return this.inventoryService.getJobStatus(jobId);
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

    getPanoramas$(): Observable<Device[]> {
        return this.panoramas$.asObservable();
    }

    getInventoryItem$(): Observable<Device | undefined> {
        return this.inventoryItem$.asObservable();
    }

    getConfig(): typeof InventoryDetailsConfig {
        return InventoryDetailsConfig;
    }
}
