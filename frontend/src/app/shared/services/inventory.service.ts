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

@Injectable({
    providedIn: "root",
})
export class InventoryService {
    // Define the API endpoints
    private apiUrl = environment.apiUrl;
    private apiEndpointInventory = `${this.apiUrl}/api/v1/inventory/`;
    private apiEndpointFirewallPlatforms = `${this.apiUrl}/api/v1/inventory/platforms/firewall/`;
    private apiEndpointPanoramaPlatforms = `${this.apiUrl}/api/v1/inventory/platforms/panorama/`;
    private apiEndpointPanoramaDevices = `${this.apiUrl}/api/v1/inventory/?device_type=Panorama`;
    private apiEndpointRefresh = `${this.apiUrl}/api/v1/inventory/refresh/`;
    private apiEndpointSync = `${this.apiUrl}/api/v1/inventory/sync/`;

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
        return this.http
            .get<
                Device[]
            >(this.apiEndpointInventory, { headers: this.getAuthHeaders() })
            .pipe(
                map((devices) =>
                    devices.sort((a, b) =>
                        a.hostname.localeCompare(b.hostname),
                    ),
                ),
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                catchError(this.handleError.bind(this)),
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

        return this.http
            .get<Device>(url, {
                headers: this.getAuthHeaders(),
            })
            .pipe(
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Retrieves the list of firewall platforms from the server.
     *
     * @returns An Observable that emits an array of DeviceType objects representing the firewall platforms.
     */
    getFirewallPlatforms(): Observable<DeviceType[]> {
        return this.http
            .get<DeviceType[]>(this.apiEndpointFirewallPlatforms)
            .pipe(
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Retrieves the Panorama devices from the server.
     *
     * @returns An Observable that emits an array of Device objects.
     */
    getPanoramaDevices(): Observable<Device[]> {
        return this.http
            .get<
                Device[]
            >(this.apiEndpointPanoramaDevices, { headers: this.getAuthHeaders() })
            .pipe(
                // Sort the devices by hostname
                map((devices) =>
                    devices.sort((a, b) =>
                        a.hostname.localeCompare(b.hostname),
                    ),
                ),
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Retrieves the Panorama platforms from the server.
     *
     * @returns An Observable that emits an array of DeviceType objects.
     */
    getPanoramaPlatforms(): Observable<DeviceType[]> {
        return this.http
            .get<
                DeviceType[]
            >(this.apiEndpointPanoramaPlatforms, { headers: this.getAuthHeaders() })
            .pipe(
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Creates a new device in the inventory.
     *
     * @param inventoryItem The device object to be created.
     * @returns An Observable that emits the created device.
     */
    createDevice(inventoryItem: Device): Observable<Device> {
        return this.http
            .post<Device>(this.apiEndpointInventory, inventoryItem, {
                headers: this.getAuthHeaders(),
            })
            .pipe(
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
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

        return this.http
            .patch<Device>(url, inventoryItem, {
                headers: this.getAuthHeaders(),
            })
            .pipe(
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
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

        return this.http.delete(url, { headers: this.getAuthHeaders() }).pipe(
            // Retry the request for server errors up to 3 times with an exponential backoff strategy
            retryWhen((errors) =>
                errors.pipe(
                    mergeMap((error: HttpErrorResponse, i) => {
                        const retryAttempt = i + 1;
                        if (retryAttempt <= 3 && this.shouldRetry(error)) {
                            // Apply an exponential backoff strategy
                            const delayTime = Math.pow(2, retryAttempt) * 1000;
                            return timer(delayTime);
                        } else {
                            // After 3 retries, throw error
                            return throwError(() => error);
                        }
                    }),
                ),
            ),
            // Log an error message and return an empty array if the request fails
            catchError(this.handleError.bind(this)),
        );
    }

    /**
     * Refreshes the device details by sending a POST request to the API.
     *
     * @param refreshForm - The form data to be sent in the request.
     * @returns An Observable that emits the job ID of the refresh request, or null if an error occurs.
     */
    refreshDevice(refreshForm: any): Observable<string | null> {
        return this.http
            .post<{ job_id: string }>(this.apiEndpointRefresh, refreshForm, {
                headers: this.getAuthHeaders(),
            })
            .pipe(
                map((response) => response.job_id),
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Retrieves the status of a job.
     *
     * @param jobId The ID of the job.
     * @returns An Observable that emits an object containing the status of the job.
     */
    getJobStatus(jobId: string): Observable<{ status: string }> {
        const url = `${this.apiUrl}/api/v1/inventory/job-status/?job_id=${jobId}`;

        return this.http
            .get<{
                status: string;
            }>(url, {
                headers: this.getAuthHeaders(),
            })
            .pipe(
                tap((response) => {
                    // Show the job status in SnackBar
                    this.snackBar.open(
                        `Job status for job ID ${jobId}: ${response.status}`,
                        "Close",
                        {
                            duration: 5000, // 5 seconds
                            verticalPosition: "bottom",
                        },
                    );
                }),
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Synchronizes the inventory by sending a POST request to the server.
     *
     * @param syncForm - The device sync form containing the necessary data.
     * @returns An Observable that emits the job ID of the synchronization request, or null if an error occurs.
     */
    syncInventory(syncForm: DeviceSyncForm): Observable<string | null> {
        return this.http
            .post<{ job_id: string }>(this.apiEndpointSync, syncForm, {
                headers: this.getAuthHeaders(),
            })
            .pipe(
                map((response) => response.job_id),
                // Retry the request for server errors up to 3 times with an exponential backoff strategy
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                // Apply an exponential backoff strategy
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                // After 3 retries, throw error
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                // Log an error message and return an empty array if the request fails
                catchError(this.handleError.bind(this)),
            );
    }
}
