// src/app/pages/inventory-details/inventory-details-processor.service.ts

import { Injectable } from "@angular/core";
import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

@Injectable({
    providedIn: "root",
})
export class InventoryDetailsProcessorService {
    requireIpAddress(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const ipv4Control = control.get("ipv4_address");
            const ipv6Control = control.get("ipv6_address");

            if (
                (ipv4Control && ipv4Control.value && ipv4Control.invalid) ||
                (ipv6Control && ipv6Control.value && ipv6Control.invalid)
            ) {
                return { invalidIpAddress: true };
            }

            if (!ipv4Control?.value && !ipv6Control?.value) {
                return { requireIpAddress: true };
            }

            return null;
        };
    }

    updateFormValidation(formGroup: AbstractControl, deviceType: string): void {
        const deviceGroupControl = formGroup.get("device_group");
        const panoramaApplianceControl = formGroup.get("panorama_appliance_id");
        const panoramaManagedControl = formGroup.get("panorama_managed");

        if (deviceType === "Firewall") {
            deviceGroupControl?.setValidators([]);
            panoramaApplianceControl?.setValidators([]);
            panoramaManagedControl?.setValidators([]);
        } else if (deviceType === "Panorama") {
            deviceGroupControl?.clearValidators();
            panoramaApplianceControl?.clearValidators();
            panoramaManagedControl?.clearValidators();
        }

        deviceGroupControl?.updateValueAndValidity();
        panoramaApplianceControl?.updateValueAndValidity();
        panoramaManagedControl?.updateValueAndValidity();
    }
}
