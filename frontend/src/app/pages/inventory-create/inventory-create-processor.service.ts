/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/inventory-create/inventory-create-processor.service.ts

import { Injectable } from "@angular/core";
import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

@Injectable({
    providedIn: "root",
})
export class InventoryCreateProcessorService {
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

    updateFormValidation(
        formGroup: AbstractControl,
        device_type: string,
    ): void {
        const device_groupControl = formGroup.get("device_group");
        const panorama_applianceControl = formGroup.get(
            "panorama_appliance_id",
        );
        const panorama_managedControl = formGroup.get("panorama_managed");

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
