// frontend/src/app/shared/services/inventory.service.ts

import { Firewall, FirewallPlatform } from "../interfaces/firewall.interface";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { Panorama, PanoramaPlatform } from "../interfaces/panorama.interface";
import { catchError, map } from "rxjs/operators";

import { CookieService } from "ngx-cookie-service";
import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class InventoryService {
    private apiUrl = environment.apiUrl;

    constructor(
        private http: HttpClient,
        private cookieService: CookieService,
    ) {}

    fetchInventoryData(): Observable<(Firewall | Panorama)[]> {
        return this.http
            .get<(Firewall | Panorama)[]>(`${this.apiUrl}/api/v1/inventory/`)
            .pipe(
                map((inventory: (Firewall | Panorama)[]) =>
                    inventory.sort((a, b) =>
                        a.hostname.localeCompare(b.hostname),
                    ),
                ),
                catchError((error) => {
                    console.error("Error fetching Inventory data:", error);
                    return of([]);
                }),
            );
    }

    getInventoryItem(uuid: string): Observable<Firewall | Panorama> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<
                Firewall | Panorama
            >(`${this.apiUrl}/api/v1/inventory/${uuid}/`, { headers })
            .pipe(
                catchError((error) => {
                    console.error("Error fetching inventory item:", error);
                    throw error;
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
        inventoryItem: Firewall | Panorama,
    ): Observable<Firewall | Panorama> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .post<
                Firewall | Panorama
            >(`${this.apiUrl}/api/v1/inventory/`, inventoryItem, { headers })
            .pipe(
                catchError((error) => {
                    console.error("Error creating inventory item:", error);
                    throw error;
                }),
            );
    }

    updateInventoryItem(
        inventoryItem: Firewall | Panorama,
        uuid: string,
    ): Observable<Firewall | Panorama> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .patch<
                Firewall | Panorama
            >(`${this.apiUrl}/api/v1/inventory/${uuid}/`, inventoryItem, { headers })
            .pipe(
                catchError((error: any) => {
                    console.error("Error updating inventory item:", error);
                    throw error;
                }),
            );
    }

    deleteInventoryItem(uuid: string): Observable<any> {
        const authToken = this.cookieService.get("auth_token");
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

    fetchInventoryPlatforms(): Observable<
        (FirewallPlatform | PanoramaPlatform)[]
    > {
        return this.http
            .get<
                (FirewallPlatform | PanoramaPlatform)[]
            >(`${this.apiUrl}/api/v1/inventory/platforms/`)
            .pipe(
                map((platforms: (FirewallPlatform | PanoramaPlatform)[]) =>
                    platforms.sort((a, b) => a.name.localeCompare(b.name)),
                ),
                catchError((error) => {
                    console.error("Error fetching Inventory platforms:", error);
                    return of([]);
                }),
            );
    }

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
}