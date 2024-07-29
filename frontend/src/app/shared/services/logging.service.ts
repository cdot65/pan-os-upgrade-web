/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/services/logging.service.ts

import { BehaviorSubject, forkJoin, Observable, throwError, timer } from "rxjs";
import {
    ForbiddenError,
    LoggingServiceError,
    NotFoundError,
    ServerError,
    UnauthorizedError,
} from "../errors/logging-service.error";
import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
} from "@angular/common/http";
import {
    JobLogEntry,
    JobStatusAndLogs,
} from "../interfaces/job-log-entry.interface";
import { catchError, map, mergeMap, retryWhen } from "rxjs/operators";

import { CookieService } from "ngx-cookie-service";
import { Injectable } from "@angular/core";
import { JobStatus } from "../interfaces/job.interface";
import { MatSnackBar } from "@angular/material/snack-bar";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class LoggingService {
    // Define the API endpoints
    private apiUrl = environment.apiUrl;
    private apiEndpointJobs = `${this.apiUrl}/api/v1/jobs/`;

    public jobStatusAndLogs$ = new BehaviorSubject<JobStatusAndLogs | null>(
        null,
    );

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
        let loggingError: LoggingServiceError;

        if (error.error instanceof ErrorEvent) {
            // A client-side or network error occurred.
            loggingError = new LoggingServiceError(
                error.error,
                `An error occurred: ${error.error.message}`,
            );
        } else {
            // The backend returned an unsuccessful response code.
            switch (error.status) {
                case 401:
                    loggingError = new UnauthorizedError(error);
                    break;
                case 403:
                    loggingError = new ForbiddenError(error);
                    break;
                case 404:
                    loggingError = new NotFoundError(error);
                    break;
                case 500:
                    loggingError = new ServerError(error);
                    break;
                default:
                    loggingError = new LoggingServiceError(
                        error,
                        `Backend returned code ${error.status}, body was: ${error.error}`,
                    );
            }
        }

        this.snackBar.open(loggingError.message, "Close", {
            duration: 5000,
            verticalPosition: "bottom",
        });

        return throwError(() => loggingError);
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
     * Retrieves the job details for a specific job UUID.
     *
     * @param jobUuid - The UUID of the job.
     * @returns An Observable that emits the job details.
     */
    getJob(uuid: string): Observable<JobStatus> {
        const url = `${this.apiEndpointJobs}${uuid}/`;

        return this.http
            .get<JobStatus>(url, { headers: this.getAuthHeaders() })
            .pipe(
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Retrieves the job logs for a specific job UUID.
     *
     * @param jobUuid - The UUID of the job.
     * @returns An Observable that emits the job logs.
     */
    getJobLogs(uuid: string): Observable<JobLogEntry[]> {
        const url = `${this.apiEndpointJobs}${uuid}/logs/`;

        return this.http
            .get<JobLogEntry[]>(url, { headers: this.getAuthHeaders() })
            .pipe(
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                return throwError(() => error);
                            }
                        }),
                    ),
                ),
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Retrieves the job details and logs for a specific job UUID.
     *
     * @param uuid - The UUID of the job.
     * @returns An Observable that emits the combined job details and logs.
     */
    getJobDetailsAndLogs(uuid: string): Observable<JobStatusAndLogs> {
        return forkJoin([this.getJob(uuid), this.getJobLogs(uuid)]).pipe(
            map(([job, logs]) => ({ job, logs })),
            catchError(this.handleError.bind(this)),
        );
    }

    /**
     * Retrieves the current value of the job details and logs.
     *
     * @returns The current value of the job details and logs.
     */
    getJobDetailsAndLogsValue(): JobStatusAndLogs | null {
        return this.jobStatusAndLogs$.getValue();
    }

    /**
     * Sets the value of the job details and logs.
     *
     * @param jobDetails - The job details and logs to set.
     */
    setJobDetailsAndLogs(jobDetails: JobStatusAndLogs | null): void {
        this.jobStatusAndLogs$.next(jobDetails);
    }
}
