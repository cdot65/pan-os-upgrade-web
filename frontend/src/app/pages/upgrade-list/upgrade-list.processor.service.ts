/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/upgrade-list/upgrade-list.processor.service.ts

import { Injectable } from "@angular/core";
import { Device } from "../../shared/interfaces/device.interface";
import { HttpErrorResponse } from "@angular/common/http";

@Injectable()
export class UpgradeListProcessorService {
    filterFirewallDevices(devices: Device[]): Device[] {
        return devices.filter((device) => device.device_type === "Firewall");
    }

    checkDeviceEligibility(device: Device | undefined): boolean {
        if (device) {
            return (
                device.local_state === "passive" ||
                device.local_state === "active-secondary" ||
                device.ha_enabled === false
            );
        }
        return false;
    }

    getDeviceHaProperties(device: Device | undefined): {
        ha_enabled: boolean;
        local_state: string | null;
        peer_ip: string | null;
        peer_state: string | null;
    } {
        if (device && device.ha_enabled) {
            return {
                ha_enabled: true,
                local_state: device.local_state || null,
                peer_ip: device.peer_ip || null,
                peer_state: device.peer_state || null,
            };
        } else {
            return {
                ha_enabled: false,
                local_state: "n/a",
                peer_ip: "n/a",
                peer_state: "n/a",
            };
        }
    }

    shouldRetry(error: HttpErrorResponse): boolean {
        return error.status >= 500 || error.error instanceof ErrorEvent;
    }
}
