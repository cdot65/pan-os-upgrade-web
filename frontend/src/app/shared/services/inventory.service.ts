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
import {
    catchError,
    map,
    mergeMap,
    retryWhen,
    switchMap,
    takeWhile,
    tap,
} from "rxjs/operators";

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

    /**
     * Constructor for initializing HTTP client, snack bar, and cookie service.
     * @param http {HttpClient} Angular's HttpClient for making HTTP requests
     * @param snackBar {MatSnackBar} Material's SnackBar for displaying notifications
     * @param cookieService {CookieService} Service for handling browser cookies
     */
    constructor(
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private cookieService: CookieService,
    ) {}

    /**
     * Generates HTTP headers with an authorization token for authenticated requests.
     * @throws Error If the auth_token cookie is not set
     * @returns HttpHeaders object with the Authorization header set
     */
    private getAuthHeaders(): HttpHeaders {
        const authToken = this.cookieService.get("auth_token");
        return new HttpHeaders().set("Authorization", `Token ${authToken}`);
    }

    /**
     * Handles HTTP errors and creates appropriate InventoryError instances.
     * @param error {HttpErrorResponse} The HTTP error response to handle
     * @throws InventoryError Various subtypes based on the error status
     * @returns An Observable that emits the created InventoryError
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

    /**
     * Handles HTTP requests with retry logic and error handling.
     * @param request {Observable<"T">} The HTTP request observable
     * @throws Error If the request fails after 3 retry attempts
     * @returns The handled HTTP request observable
     */
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
     * Determines if an HTTP request should be retried based on the error response.
     * @param error {HttpErrorResponse} The HTTP error response to evaluate
     * @returns True if the request should be retried, false otherwise
     */
    private shouldRetry(error: HttpErrorResponse): boolean {
        // Retry only for 5xx errors (server errors) and network errors
        return error.status >= 500 || error.error instanceof ErrorEvent;
    }

    /**
     * Retrieves a sorted list of devices from the inventory API.
     * @throws HttpErrorResponse If the HTTP request fails
     * @returns An Observable of Device array sorted by hostname
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
     * Retrieves a device by its UUID from the inventory API.
     * @param uuid {string} The unique identifier of the device
     * @throws HttpErrorResponse If the HTTP request fails
     * @returns An Observable that emits the requested Device object
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
     * Retrieves a list of firewall platforms (device types) from the API.
     * @returns An Observable that emits an array of DeviceType objects
     */
    getFirewallPlatforms(): Observable<DeviceType[]> {
        return this.handleHttpRequest(
            this.http.get<DeviceType[]>(this.apiEndpointFirewallPlatforms),
        );
    }

    /**
     * Retrieves a list of Panorama platforms from the API.
     * @throws HttpErrorResponse If the HTTP request fails
     * @returns An Observable of DeviceType array representing Panorama platforms
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
     * @param inventoryItem {Device} The device object to be added to the inventory
     * @returns An Observable that emits the created Device object
     */
    createDevice(inventoryItem: Device): Observable<Device> {
        return this.handleHttpRequest(
            this.http.post<Device>(this.apiEndpointInventory, inventoryItem, {
                headers: this.getAuthHeaders(),
            }),
        );
    }

    /**
     * Updates a device in the inventory using a PATCH request.
     * @param inventoryItem {Device} The updated device information
     * @param uuid {string} The unique identifier of the device to update
     * @returns An Observable that emits the updated Device object
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
     * Deletes a device from the inventory using its UUID.
     * @param uuid {string} The unique identifier of the device to delete
     * @returns An Observable that emits the response from the delete request
     */
    deleteDevice(uuid: string): Observable<any> {
        const url = `${this.apiEndpointInventory}${uuid}/`;

        return this.handleHttpRequest(
            this.http.delete(url, { headers: this.getAuthHeaders() }),
        );
    }

    /**
     * Refreshes a device by sending a POST request to the API endpoint.
     * @param refreshForm {any} The form data to be sent in the request body
     * @returns An Observable that emits the job ID or null
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
     * Retrieves the status of a job and displays it in a snackbar.
     * @param jobId {string} The ID of the job to check
     * @returns An Observable that emits the job status
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
     * Polls a job status at specified intervals until completion or failure.
     * @param jobId {string} The ID of the job to poll
     * @param interval {number} The polling interval in milliseconds (default: 2000)
     * @returns An Observable emitting job status updates
     */
    pollJobStatus(
        jobId: string,
        interval: number = 2000,
    ): Observable<{ status: string }> {
        return timer(interval, interval).pipe(
            switchMap(() => this.getJobStatus(jobId)),
            takeWhile(
                (response) =>
                    response.status !== "completed" &&
                    response.status !== "failed",
                true,
            ),
        );
    }

    /**
     * Synchronizes inventory by sending a POST request to the API endpoint.
     * @param syncForm {DeviceSyncForm} The form data for device synchronization
     * @returns An Observable that emits the job ID or null
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
