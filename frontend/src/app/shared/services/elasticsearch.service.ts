/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/services/elasticsearch.service.ts

import {
    ElasticsearchError,
    ForbiddenError,
    NotFoundError,
    ServerError,
    UnauthorizedError,
} from "../errors/elasticsearch.error";
import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
} from "@angular/common/http";
import { Observable, interval, throwError, timer } from "rxjs";
import { catchError, mergeMap, retryWhen, switchMap } from "rxjs/operators";

import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";

@Injectable({
    providedIn: "root",
})
export class ElasticsearchService {
    private apiUrl = "http://localhost:9200";

    constructor(
        private http: HttpClient,
        private snackBar: MatSnackBar,
    ) {}

    /**
     * Returns the HttpHeaders object with the appropriate Content-Type header.
     *
     * @returns The HttpHeaders object.
     */
    private getHeaders(): HttpHeaders {
        return new HttpHeaders().set("Content-Type", "application/json");
    }

    /**
     * Handles the error response from an HTTP request and returns an Observable that emits the error.
     *
     * @param error - The HttpErrorResponse object representing the error response.
     * @returns An Observable that emits the error.
     */
    private handleError(error: HttpErrorResponse): Observable<never> {
        let inventoryError: ElasticsearchError;

        if (error.error instanceof ErrorEvent) {
            // A client-side or network error occurred.
            inventoryError = new ElasticsearchError(
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
                    inventoryError = new ElasticsearchError(
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

    getLogsAll(path: string): Observable<any> {
        const url = `${this.apiUrl}/python-logs-${path}-*/_search`;
        const body = {
            from: 0,
            size: 100,
            query: {
                match_all: {},
            },
            sort: [
                {
                    "extra.sequence_number": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
                {
                    "@timestamp": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
            ],
        };

        return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
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
            catchError(this.handleError.bind(this)),
        );
    }

    getLogsById(
        jobId: string,
        path: string,
        pollingInterval: number,
    ): Observable<any> {
        const url = `${this.apiUrl}/python-logs-${path}-*/_search`;
        const body = {
            from: 0,
            size: 100,
            query: {
                match: {
                    "extra.job_id": jobId,
                },
            },
            sort: [
                {
                    "extra.sequence_number": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
                {
                    "@timestamp": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
            ],
        };

        return interval(pollingInterval).pipe(
            switchMap(() =>
                this.http.post(url, body, { headers: this.getHeaders() }),
            ),
        );
    }

    getLogsByIdOnce(jobId: string, path: string): Observable<any> {
        const url = `${this.apiUrl}/python-logs-${path}-*/_search`;
        const body = {
            from: 0,
            size: 100,
            query: {
                match: {
                    "extra.job_id": jobId,
                },
            },
            sort: [
                {
                    "extra.sequence_number": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
                {
                    "@timestamp": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
            ],
        };

        return this.http.post(url, body, { headers: this.getHeaders() }).pipe(
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
