/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/services/inventory.service.ts

import {
    ForbiddenError,
    InventoryError,
    NotFoundError,
    ServerError,
    UnauthorizedError,
} from "../errors/inventory.error";
import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
    HttpParams,
} from "@angular/common/http";
import { Observable, throwError, timer } from "rxjs";
import { catchError, map, mergeMap, retryWhen, tap } from "rxjs/operators";

import { CookieService } from "ngx-cookie-service";
import { Device } from "../interfaces/device.interface";
import { DeviceSyncForm } from "../interfaces/device-sync-form.interface";
import { DeviceType } from "../interfaces/device-type.interface";
import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { environment } from "../../../environments/environment.prod";
import { ApiEndpoints } from "../enums/api-endpoints.enum";

@Injectable({
    providedIn: "root",
})
export class InventoryService {
    // Define the API endpoints
    private apiUrl = environment.apiUrl;
    private apiEndpointInventory = `${this.apiUrl}${ApiEndpoints.Inventory}`;
    private apiEndpointFirewallPlatforms = `${this.apiUrl}${ApiEndpoints.FirewallPlatforms}`;
    private apiEndpointPanoramaPlatforms = `${this.apiUrl}${ApiEndpoints.PanoramaPlatforms}`;
    private apiEndpointRefresh = `${this.apiUrl}${ApiEndpoints.Refresh}`;
    private apiEndpointSync = `${this.apiUrl}${ApiEndpoints.Sync}`;

    constructor(
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private cookieService: CookieService,
    ) {}

    /**
     * Constructs an HttpHeaders object with the Authorization header set to the authentication token.
     *
     * @returns The HttpHeaders object.
     */
    private getAuthHeaders(): HttpHeaders {
        const authToken = this.cookieService.get("auth_token");
        return new HttpHeaders().set("Authorization", `Token ${authToken}`);
    }

    /**
     * Handles the error response from an HTTP request and returns an Observable that emits the error.
     *
     * @param error - The HttpErrorResponse object representing the error response.
     * @returns An Observable that emits the error.
     */
    private handleError(error: HttpErrorResponse): Observable<never> {
        let inventoryError: InventoryError;

        if (error.error instanceof ErrorEvent) {
            // A client-side or network error occurred.
            inventoryError = new InventoryError(
                error.error,
                `An error occurred: ${error.error.message}`,
            );
        } else {
            // The backend returned an unsuccessful response code.
            switch (error.status) {
                case 401:
                    inventoryError = new UnauthorizedError(error);
                    break;
                case 403:
                    inventoryError = new ForbiddenError(error);
                    break;
                case 404:
                    inventoryError = new NotFoundError(error);
                    break;
                case 500: // Handle a specific 500 error if needed
                    inventoryError = new ServerError(error);
                    break;
                default:
                    inventoryError = new InventoryError(
                        error,
                        `Backend returned code ${error.status}, body was: ${error.error}`,
                    );
            }
        }

        this.snackBar.open(inventoryError.message, "Close", {
            duration: 5000,
            verticalPosition: "bottom",
        });

        return throwError(() => inventoryError);
    }

    private handleHttpRequest<T>(request: Observable<T>): Observable<T> {
        return request.pipe(
            retryWhen((errors) =>
                errors.pipe(
                    mergeMap((error, i) => {
                        const retryAttempt = i + 1;
                        if (retryAttempt <= 3 && this.shouldRetry(error)) {
                            return timer(Math.pow(2, retryAttempt) * 1000);
                        }
                        return throwError(() => error);
                    }),
                ),
            ),
            catchError(this.handleError.bind(this)),
        );
    }

    /**
     * Determines whether the HTTP request should be retried based on the error response.
     * Retry is only performed for 5xx errors (server errors) and network errors.
     *
     * @param error - The HTTP error response.
     * @returns A boolean value indicating whether the request should be retried.
     */
    private shouldRetry(error: HttpErrorResponse): boolean {
        // Retry only for 5xx errors (server errors) and network errors
        return error.status >= 500 || error.error instanceof ErrorEvent;
    }

    /**
     * Retrieves the list of devices from the backend server.
     *
     * @returns An Observable that emits an array of Device objects.
     */
    getDevices(): Observable<Device[]> {
        return this.handleHttpRequest(
            this.http
                .get<
                    Device[]
                >(this.apiEndpointInventory, { headers: this.getAuthHeaders() })
                .pipe(
                    map((devices) =>
                        devices.sort((a, b) =>
                            a.hostname.localeCompare(b.hostname),
                        ),
                    ),
                ),
        );
    }

    /**
     * Retrieves a device from the inventory based on its UUID.
     *
     * @param uuid The UUID of the device to retrieve.
     * @returns An Observable that emits the retrieved Device object.
     */
    getDevice(uuid: string): Observable<Device> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointInventory}${uuid}/`;

        return this.handleHttpRequest(
            this.http.get<Device>(url, {
                headers: this.getAuthHeaders(),
            }),
        );
    }

    /**
     * Retrieves the list of firewall platforms from the server.
     *
     * @returns An Observable that emits an array of DeviceType objects representing the firewall platforms.
     */
    getFirewallPlatforms(): Observable<DeviceType[]> {
        return this.handleHttpRequest(
            this.http.get<DeviceType[]>(this.apiEndpointFirewallPlatforms),
        );
    }

    /**
     * Retrieves the Panorama platforms from the server.
     *
     * @returns An Observable that emits an array of DeviceType objects.
     */
    getPanoramaPlatforms(): Observable<DeviceType[]> {
        return this.handleHttpRequest(
            this.http.get<DeviceType[]>(this.apiEndpointPanoramaPlatforms, {
                headers: this.getAuthHeaders(),
            }),
        );
    }

    /**
     * Creates a new device in the inventory.
     *
     * @param inventoryItem The device object to be created.
     * @returns An Observable that emits the created device.
     */
    createDevice(inventoryItem: Device): Observable<Device> {
        return this.handleHttpRequest(
            this.http.post<Device>(this.apiEndpointInventory, inventoryItem, {
                headers: this.getAuthHeaders(),
            }),
        );
    }

    /**
     * Updates a device in the inventory.
     *
     * @param inventoryItem - The updated device object.
     * @param uuid - The UUID of the device to update.
     * @returns An Observable that emits the updated device object.
     */
    updateDevice(inventoryItem: Device, uuid: string): Observable<Device> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointInventory}${uuid}/`;

        return this.handleHttpRequest(
            this.http.patch<Device>(url, inventoryItem, {
                headers: this.getAuthHeaders(),
            }),
        );
    }

    /**
     * Deletes a device with the specified UUID.
     *
     * @param uuid - The UUID of the device to delete.
     * @returns An observable that emits the response from the server.
     */
    deleteDevice(uuid: string): Observable<any> {
        const url = `${this.apiEndpointInventory}${uuid}/`;

        return this.handleHttpRequest(
            this.http.delete(url, { headers: this.getAuthHeaders() }),
        );
    }

    /**
     * Refreshes the device details by sending a POST request to the API.
     *
     * @param refreshForm - The form data to be sent in the request.
     * @returns An Observable that emits the job ID of the refresh request, or null if an error occurs.
     */
    refreshDevice(refreshForm: any): Observable<string | null> {
        return this.handleHttpRequest(
            this.http
                .post<{ job_id: string }>(
                    this.apiEndpointRefresh,
                    refreshForm,
                    {
                        headers: this.getAuthHeaders(),
                    },
                )
                .pipe(map((response) => response.job_id)),
        );
    }

    /**
     * Retrieves the status of a job.
     *
     * @param jobId The ID of the job.
     * @returns An Observable that emits an object containing the status of the job.
     */
    getJobStatus(jobId: string): Observable<{ status: string }> {
        const params = new HttpParams().set("job_id", jobId);
        return this.handleHttpRequest(
            this.http.get<{ status: string }>(
                `${this.apiUrl}/api/v1/inventory/job-status/`,
                {
                    headers: this.getAuthHeaders(),
                    params,
                },
            ),
        ).pipe(
            tap((response) => {
                this.snackBar.open(
                    `Job status for job ID ${jobId}: ${response.status}`,
                    "Close",
                    {
                        duration: 5000,
                        verticalPosition: "bottom",
                    },
                );
            }),
        );
    }

    /**
     * Synchronizes the inventory by sending a POST request to the server.
     *
     * @param syncForm - The device sync form containing the necessary data.
     * @returns An Observable that emits the job ID of the synchronization request, or null if an error occurs.
     */
    syncInventory(syncForm: DeviceSyncForm): Observable<string | null> {
        return this.handleHttpRequest(
            this.http
                .post<{ job_id: string }>(this.apiEndpointSync, syncForm, {
                    headers: this.getAuthHeaders(),
                })
                .pipe(map((response) => response.job_id)),
        );
    }
}
