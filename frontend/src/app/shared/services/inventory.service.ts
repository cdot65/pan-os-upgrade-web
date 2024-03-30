// frontend/src/app/shared/services/inventory.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import {
    InventoryItem,
    InventoryItemApiResponse,
} from "../interfaces/inventory-item.interface";
import {
    InventoryList,
    InventoryListApiResponse,
} from "../interfaces/inventory-list.interface.ts";
import { Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { Injectable } from "@angular/core";
import { InventoryPlatform } from "../interfaces/inventory-platform.interface";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class InventoryService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    /**
     * Fetches the inventory data from the API.
     * @returns An Observable that emits an array of InventoryList objects.
     */
    fetchInventoryData(): Observable<InventoryList[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<
                InventoryListApiResponse[]
            >(`${this.apiUrl}/api/v1/inventory/`, { headers })
            .pipe(
                map((response: InventoryListApiResponse[]) =>
                    response.map((item: InventoryListApiResponse) =>
                        this.mapInventoryListResponse(item),
                    ),
                ),
                catchError((error) => {
                    console.error("Error fetching Inventory data:", error);
                    return of([]);
                }),
            );
    }

    /**
     * Fetches the firewall platforms from the API.
     * @returns An Observable that emits an array of InventoryItem objects.
     */
    fetchFirewallPlatforms(): Observable<InventoryPlatform[]> {
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

    /**
     * Fetches the Panorama platforms from the API.
     * @returns An Observable that emits an array of InventoryPlatform objects.
     */
    fetchPanoramaPlatforms(): Observable<InventoryPlatform[]> {
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

    /**
     * Retrieves an inventory item by its UUID.
     * @param uuid - The UUID of the inventory item.
     * @returns An Observable that emits a Firewall or Panorama object.
     * @throws Error if the inventory type is invalid.
     */
    getInventoryItem(uuid: string): Observable<InventoryItem> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<InventoryItemApiResponse>(
                `${this.apiUrl}/api/v1/inventory/${uuid}/`,
                { headers },
            )
            .pipe(
                map((response: InventoryItemApiResponse) => {
                    if ("device_type" in response) {
                        return this.mapInventoryItemResponse(
                            response as InventoryItemApiResponse,
                        );
                    }
                    // Throw an error if the mapping is not applicable
                    throw new Error("Invalid inventory type");
                }),
                catchError((error) => {
                    console.error("Error fetching inventory item:", error);
                    throw error;
                }),
            );
    }

    /**
     * Checks if an inventory exists for the given hostname.
     * @param hostname - The hostname to check.
     * @returns An Observable that emits a boolean indicating whether the inventory exists or not.
     */
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

    /**
     * Deletes an inventory item by its UUID.
     * @param uuid The UUID of the inventory item to delete.
     * @returns An Observable that emits the response from the server, or null if an error occurs.
     */
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

    /**
     * Fetches the inventory platforms from the API.
     * @returns An Observable that emits an array of strings representing the inventory platforms.
     */
    fetchInventoryPlatforms(): Observable<string[]> {
        return this.http
            .get<string[]>(`${this.apiUrl}/api/v1/inventory/platforms/`)
            .pipe(
                map((platforms: string[]) =>
                    platforms.sort((a, b) => a.localeCompare(b)),
                ),
                catchError((error) => {
                    console.error("Error fetching Inventory platforms:", error);
                    return of([]);
                }),
            );
    }

    /**
     * Executes an admin report with the given job details.
     * @param jobDetails - The details of the job to be executed.
     * @returns An Observable that emits the response from the server.
     */
    executeAdminReport(jobDetails: any): Observable<any> {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const headers = new HttpHeaders({ "Content-Type": "application/json" });
        return this.http
            .post<any>(
                `${this.apiUrl}/api/v1/assessment/admin-report`,
                jobDetails,
                { headers },
            )
            .pipe(
                catchError((error) => {
                    console.error("Error executing request:", error);
                    return of(null);
                }),
            );
    }

    /**
     * Maps a FirewallApiResponse object to a Firewall object.
     *
     * @param response - The FirewallApiResponse object to be mapped.
     * @returns The mapped Firewall object.
     */
    private mapInventoryItemResponse(
        response: InventoryItemApiResponse,
    ): InventoryItem {
        return {
            // author: response.author,
            createdAt: response.created_at,
            deviceGroup: response.device_group,
            deviceType: response.device_type,
            ha: response.ha,
            haPeer: response.ha_peer,
            hostname: response.hostname,
            ipv4Address: response.ipv4_address,
            ipv6Address: response.ipv6_address,
            notes: response.notes,
            panoramaAppliance: response.panorama_appliance,
            panoramaManaged: response.panorama_managed,
            platformName: response.platform_name,
            uuid: response.uuid,
        };
    }

    /**
     * Maps the response from the inventory list API to an InventoryList object.
     *
     * @param response - The response from the inventory list API.
     * @returns The mapped InventoryList object.
     */
    private mapInventoryListResponse(
        response: InventoryListApiResponse,
    ): InventoryList {
        return {
            // author: response.author,
            createdAt: response.created_at,
            deviceGroup: response.device_group,
            deviceType: response.device_type,
            ha: response.ha,
            haPeer: response.ha_peer,
            hostname: response.hostname,
            ipv4Address: response.ipv4_address,
            ipv6Address: response.ipv6_address,
            notes: response.notes,
            panoramaAppliance: response.panorama_appliance,
            panoramaManaged: response.panorama_managed,
            platformName: response.platform_name,
            uuid: response.uuid,
        };
    }
}
