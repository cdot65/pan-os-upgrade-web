/* eslint-disable max-len */
// frontend/src/app/shared/services/job.service.ts

import {
    ForbiddenError,
    JobError,
    NotFoundError,
    ServerError,
    UnauthorizedError,
} from "../errors/job.error";
import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
} from "@angular/common/http";
import { Observable, throwError, timer } from "rxjs";
import { catchError, map, mergeMap, retryWhen } from "rxjs/operators";

import { CookieService } from "ngx-cookie-service";
import { Injectable } from "@angular/core";
import { Job } from "../interfaces/job.interface";
import { JobLogEntry } from "../interfaces/job-log-entry.interface";
import { MatSnackBar } from "@angular/material/snack-bar";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class JobService {
    // Define the API endpoints
    private apiUrl = environment.apiUrl;
    private apiEndpointJobs = `${this.apiUrl}/api/v1/jobs/`;

    constructor(
        private cookieService: CookieService,
        private http: HttpClient,
        private snackBar: MatSnackBar,
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
        let inventoryError: JobError;

        if (error.error instanceof ErrorEvent) {
            // A client-side or network error occurred.
            inventoryError = new JobError(
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
                    inventoryError = new JobError(
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

    getJobs(): Observable<Job[]> {
        return this.http
            .get<
                Job[]
            >(this.apiEndpointJobs, { headers: this.getAuthHeaders() })
            .pipe(
                map((jobs) =>
                    jobs.sort(
                        (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime(),
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

    getJob(uuid: string): Observable<Job> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointJobs}${uuid}/`;

        return this.http
            .get<Job>(url, {
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

    getJobLogs(uuid: string): Observable<any[]> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointJobs}${uuid}/logs/`;

        return this.http
            .get<JobLogEntry[]>(url, { headers: this.getAuthHeaders() })
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

    getJobStatus(uuid: string): Observable<string> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointJobs}${uuid}/`;

        return this.http.get<Job>(url, { headers: this.getAuthHeaders() }).pipe(
            map((job) => job.job_status),
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

    deleteJob(uuid: string): Observable<any> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointJobs}${uuid}/`;

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
}
