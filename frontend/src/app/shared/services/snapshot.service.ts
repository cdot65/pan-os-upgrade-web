/* eslint-disable max-len */
// frontend/src/app/shared/services/snapshot.service.ts

import { Injectable } from "@angular/core";
import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
} from "@angular/common/http";
import { Observable, throwError, timer } from "rxjs";
import { catchError, mergeMap, retryWhen } from "rxjs/operators";
import { Snapshot } from "../interfaces/snapshot.interface";
import { environment } from "../../../environments/environment";
import { CookieService } from "ngx-cookie-service";
import { MatSnackBar } from "@angular/material/snack-bar";
import {
    ForbiddenError,
    NotFoundError,
    ServerError,
    SnapshotError,
    UnauthorizedError,
} from "../errors/snapshot.error";

@Injectable({
    providedIn: "root",
})
export class SnapshotService {
    private apiUrl = environment.apiUrl;
    private apiEndpointSnapshots = `${this.apiUrl}/api/v1/snapshots/`;

    constructor(
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private cookieService: CookieService,
    ) {}

    private getAuthHeaders(): HttpHeaders {
        const authToken = this.cookieService.get("auth_token");
        return new HttpHeaders().set("Authorization", `Token ${authToken}`);
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
        let snapshotError: SnapshotError;

        if (error.error instanceof ErrorEvent) {
            snapshotError = new SnapshotError(
                error.error,
                `An error occurred: ${error.error.message}`,
            );
        } else {
            switch (error.status) {
                case 401:
                    snapshotError = new UnauthorizedError(error);
                    break;
                case 403:
                    snapshotError = new ForbiddenError(error);
                    break;
                case 404:
                    snapshotError = new NotFoundError(error);
                    break;
                case 500:
                    snapshotError = new ServerError(error);
                    break;
                default:
                    snapshotError = new SnapshotError(
                        error,
                        `Backend returned code ${error.status}, body was: ${error.error}`,
                    );
            }
        }

        this.snackBar.open(snapshotError.message, "Close", {
            duration: 5000,
            verticalPosition: "bottom",
        });

        return throwError(() => snapshotError);
    }

    private shouldRetry(error: HttpErrorResponse): boolean {
        return error.status >= 500 || error.error instanceof ErrorEvent;
    }

    getSnapshots(): Observable<Snapshot[]> {
        return this.http
            .get<
                Snapshot[]
            >(this.apiEndpointSnapshots, { headers: this.getAuthHeaders() })
            .pipe(
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            }
                            return throwError(() => error);
                        }),
                    ),
                ),
                catchError(this.handleError.bind(this)),
            );
    }

    getSnapshotsByJobId(jobId: string): Observable<Snapshot[]> {
        const url = `${this.apiEndpointSnapshots}job/${jobId}/`;
        return this.http
            .get<Snapshot[]>(url, { headers: this.getAuthHeaders() })
            .pipe(
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            }
                            return throwError(() => error);
                        }),
                    ),
                ),
                catchError(this.handleError.bind(this)),
            );
    }

    // Add more methods here as needed, following the same pattern
    // For example, if you need to create a snapshot:
    createSnapshot(snapshotData: any): Observable<Snapshot> {
        return this.http
            .post<Snapshot>(this.apiEndpointSnapshots, snapshotData, {
                headers: this.getAuthHeaders(),
            })
            .pipe(
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && this.shouldRetry(error)) {
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            }
                            return throwError(() => error);
                        }),
                    ),
                ),
                catchError(this.handleError.bind(this)),
            );
    }
}
