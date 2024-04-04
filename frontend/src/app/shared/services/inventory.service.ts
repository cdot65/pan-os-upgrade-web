// frontend/src/app/shared/services/inventory.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";

import { Injectable } from "@angular/core";
import { InventoryItem } from "../interfaces/inventory-item.interface";
import { InventoryPlatform } from "../interfaces/inventory-platform.interface";
import { catchError } from "rxjs/operators";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class InventoryService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    getInventoryItems(): Observable<InventoryItem[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<
                InventoryItem[]
            >(`${this.apiUrl}/api/v1/inventory/`, { headers })
            .pipe(
                catchError((error) => {
                    console.error("Error fetching Inventory data:", error);
                    return of([]);
                }),
            );
    }

    getInventoryItem(uuid: string): Observable<InventoryItem> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<InventoryItem>(`${this.apiUrl}/api/v1/inventory/${uuid}/`, {
                headers,
            })
            .pipe(
                catchError((error) => {
                    console.error("Error fetching inventory item:", error);
                    throw error;
                }),
            );
    }

    getFirewallPlatforms(): Observable<InventoryPlatform[]> {
        return this.http
            .get<
                InventoryPlatform[]
            >(`${this.apiUrl}/api/v1/inventory/platforms/firewall/`)
            .pipe(
                catchError((error) => {
                    console.error("Error fetching firewall platforms:", error);
                    return of([]);
                }),
            );
    }

    getPanoramaDevices(): Observable<InventoryItem[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<
                InventoryItem[]
            >(`${this.apiUrl}/api/v1/inventory/?device_type=Panorama`, { headers })
            .pipe(
                catchError((error) => {
                    console.error("Error fetching Panorama devices:", error);
                    return of([]);
                }),
            );
    }

    getPanoramaPlatforms(): Observable<InventoryPlatform[]> {
        return this.http
            .get<
                InventoryPlatform[]
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

    createInventoryItem(
        inventoryItem: InventoryItem,
    ): Observable<InventoryItem> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .post<InventoryItem>(
                `${this.apiUrl}/api/v1/inventory/`,
                inventoryItem,
                { headers },
            )
            .pipe(
                catchError((error) => {
                    console.error("Error creating inventory item:", error);
                    throw error;
                }),
            );
    }

    updateInventoryItem(
        inventoryItem: InventoryItem,
        uuid: string,
    ): Observable<InventoryItem> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .patch<InventoryItem>(
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

    deleteInventoryItem(uuid: string): Observable<any> {
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
}
