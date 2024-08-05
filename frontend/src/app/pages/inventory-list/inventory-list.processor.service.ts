// inventory-list.processor.service.ts

import { Injectable } from "@angular/core";
import { Device } from "../../shared/interfaces/device.interface";

@Injectable({
    providedIn: "root",
})
export class InventoryListProcessorService {
    isAllSelected(selected: Device[], total: Device[]): boolean {
        return selected.length === total.length;
    }

    isSyncFromPanoramaButtonActive(selected: Device[]): boolean {
        return (
            selected.length > 0 &&
            selected.every((device) => device.device_type === "Panorama")
        );
    }

    checkboxLabel(isAllSelected: boolean, row?: Device): string {
        if (!row) {
            return `${isAllSelected ? "select" : "deselect"} all`;
        }
        return `${isAllSelected ? "deselect" : "select"} row ${row.hostname}`;
    }

    // Add other complex processing methods here
}
