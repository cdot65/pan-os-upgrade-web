/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/services/inventory.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { Device } from "../interfaces/device.interface";
import { DeviceType } from "../interfaces/device-type.interface";
import { Injectable } from "@angular/core";
import { InventorySyncForm } from "../interfaces/inventory-sync-form.interface";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class InventoryService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    getDevices(): Observable<Device[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<Device[]>(`${this.apiUrl}/api/v1/inventory/`, { headers })
            .pipe(
                map((devices) =>
                    devices.sort((a, b) =>
                        a.hostname.localeCompare(b.hostname),
                    ),
                ),
                catchError((error) => {
                    console.error("Error fetching Inventory data:", error);
                    return of([]);
                }),
            );
    }

    getDevice(uuid: string): Observable<Device> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<Device>(`${this.apiUrl}/api/v1/inventory/${uuid}/`, {
                headers,
            })
            .pipe(
                catchError((error) => {
                    console.error("Error fetching inventory item:", error);
                    throw error;
                }),
            );
    }

    getFirewallPlatforms(): Observable<DeviceType[]> {
        return this.http
            .get<
                DeviceType[]
            >(`${this.apiUrl}/api/v1/inventory/platforms/firewall/`)
            .pipe(
                catchError((error) => {
                    console.error("Error fetching firewall platforms:", error);
                    return of([]);
                }),
            );
    }

    getPanoramaDevices(): Observable<Device[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<
                Device[]
            >(`${this.apiUrl}/api/v1/inventory/?device_type=Panorama`, { headers })
            .pipe(
                map((devices) =>
                    devices.sort((a, b) =>
                        a.hostname.localeCompare(b.hostname),
                    ),
                ),
                catchError((error) => {
                    console.error("Error fetching Panorama devices:", error);
                    return of([]);
                }),
            );
    }

    getPanoramaPlatforms(): Observable<DeviceType[]> {
        return this.http
            .get<
                DeviceType[]
            >(`${this.apiUrl}/api/v1/inventory/platforms/panorama/`)
            .pipe(
                catchError((error) => {
                    console.error("Error fetching panorama platforms:", error);
                    return of([]);
                }),
            );
    }

    inventoryExists(hostname: string): Observable<boolean> {
        const formattedValue = hostname.toLowerCase().replace(/[\s-]/g, "_");
        const path = "api/v1/inventory/exists?hostname";
        return this.http
            .get<boolean>(
                // tslint:disable-next-line: max-line-length
                `${this.apiUrl}/${path}=${hostname}&formatted_value=${formattedValue}`,
            )
            .pipe(
                catchError((error) => {
                    console.error("Error checking inventory:", error);
                    return of(false);
                }),
            );
    }

    createDevice(inventoryItem: Device): Observable<Device> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .post<Device>(`${this.apiUrl}/api/v1/inventory/`, inventoryItem, {
                headers,
            })
            .pipe(
                catchError((error) => {
                    console.error("Error creating inventory item:", error);
                    throw error;
                }),
            );
    }

    updateDevice(inventoryItem: Device, uuid: string): Observable<Device> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .patch<Device>(
                `${this.apiUrl}/api/v1/inventory/${uuid}/`,
                inventoryItem,
                { headers },
            )
            .pipe(
                catchError((error: any) => {
                    console.error("Error updating inventory item:", error);
                    throw error;
                }),
            );
    }

    deleteDevice(uuid: string): Observable<any> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .delete(`${this.apiUrl}/api/v1/inventory/${uuid}/`, { headers })
            .pipe(
                catchError((error) => {
                    console.error("Error deleting Inventory item:", error);
                    return of(null);
                }),
            );
    }

    refreshDevice(refreshForm: any): Observable<string | null> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .post<{ job_id: string }>(
                `${this.apiUrl}/api/v1/inventory/refresh/`,
                refreshForm,
                {
                    headers,
                },
            )
            .pipe(
                map((response) => response.job_id),
                catchError((error) => {
                    console.error("Error refreshing device details:", error);
                    return of(null);
                }),
            );
    }

    getJobStatus(jobId: string): Observable<{ status: string }> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.get<{ status: string }>(
            `${this.apiUrl}/api/v1/inventory/job-status/?job_id=${jobId}`,
            { headers },
        );
    }

    syncInventory(syncForm: InventorySyncForm): Observable<any> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .post(`${this.apiUrl}/api/v1/inventory/sync/`, syncForm, {
                headers,
            })
            .pipe(
                catchError((error) => {
                    console.error("Error syncing inventory:", error);
                    return of(null);
                }),
            );
    }
}
