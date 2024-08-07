/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/inventory-list/inventory-list.facade.ts

import { Injectable } from "@angular/core";
import { BehaviorSubject, forkJoin, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Device } from "../../shared/interfaces/device.interface";
import { DeviceSyncForm } from "../../shared/interfaces/device-sync-form.interface";
import { InventoryService } from "../../shared/services/inventory.service";
import { CookieService } from "ngx-cookie-service";

@Injectable()
export class InventoryListFacade {
    private inventoryItemsSubject = new BehaviorSubject<Device[]>([]);

    constructor(
        private inventoryService: InventoryService,
        private cookieService: CookieService,
    ) {}

    getInventoryItems(): Observable<Device[]> {
        return this.inventoryItemsSubject.asObservable();
    }

    loadInventoryItems(): void {
        this.inventoryService.getDevices().subscribe(
            (items) => {
                const sortedItems = items.sort((a, b) =>
                    a.hostname.localeCompare(b.hostname),
                );
                this.inventoryItemsSubject.next(sortedItems);
            },
            (error) => console.error("Error fetching inventory items:", error),
        );
    }

    deleteDevices(deviceUuids: string[]): Observable<any[]> {
        const deleteRequests = deviceUuids.map((uuid) =>
            this.inventoryService.deleteDevice(uuid),
        );
        return forkJoin(deleteRequests);
    }

    refreshDevices(refreshForms: any[]): Observable<string[]> {
        const author = this.cookieService.get("author");
        const refreshRequests = refreshForms.map((form) => {
            form.author = author ? parseInt(author, 10) : 0;
            return this.inventoryService.refreshDevice(form);
        });
        return forkJoin(refreshRequests).pipe(
            map((results) =>
                results.filter((result): result is string => result !== null),
            ),
        );
    }

    syncInventory(syncForms: DeviceSyncForm[]): Observable<string[]> {
        const syncRequests = syncForms.map((form) =>
            this.inventoryService.syncInventory(form),
        );
        return forkJoin(syncRequests).pipe(
            map((results) =>
                results.filter((result): result is string => result !== null),
            ),
        );
    }

    getJobStatus(jobId: string): Observable<any> {
        return this.inventoryService.getJobStatus(jobId);
    }
}
