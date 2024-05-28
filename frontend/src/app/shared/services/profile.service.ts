/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/services/settings.service.ts

import {
    ForbiddenError,
    NotFoundError,
    ProfileError,
    ServerError,
    UnauthorizedError,
} from "../errors/profile.error";
import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
} from "@angular/common/http";
import { Observable, throwError, timer } from "rxjs";
import { catchError, mergeMap, retryWhen } from "rxjs/operators";

import { CookieService } from "ngx-cookie-service";
import { Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Profile } from "../interfaces/profile.interface";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class ProfileService {
    // Define the API endpoints
    private apiUrl = environment.apiUrl;
    private apiEndpointProfiles = `${this.apiUrl}/api/v1/profiles/`;

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
        let profileError: ProfileError;

        if (error.error instanceof ErrorEvent) {
            // A client-side or network error occurred.
            profileError = new ProfileError(
                error.error,
                `An error occurred: ${error.error.message}`,
            );
        } else {
            // The backend returned an unsuccessful response code.
            switch (error.status) {
                case 401:
                    profileError = new UnauthorizedError(error);
                    break;
                case 403:
                    profileError = new ForbiddenError(error);
                    break;
                case 404:
                    profileError = new NotFoundError(error);
                    break;
                case 500: // Handle a specific 500 error if needed
                    profileError = new ServerError(error);
                    break;
                default:
                    profileError = new ProfileError(
                        error,
                        `Backend returned code ${error.status}, body was: ${error.error}`,
                    );
            }
        }

        this.snackBar.open(profileError.message, "Close", {
            duration: 5000,
            verticalPosition: "bottom",
        });

        return throwError(() => profileError);
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
     * Retrieves the profiles from the server.
     *
     * @returns An Observable that emits an array of Profile objects.
     */
    getProfiles(): Observable<Profile[]> {
        return this.http
            .get<Profile[]>(this.apiEndpointProfiles, {
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
     * Retrieves a profile by its UUID.
     *
     * @param uuid - The UUID of the profile to retrieve.
     * @returns An Observable that emits the retrieved Profile.
     */
    getProfile(uuid: string): Observable<Profile> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointProfiles}${uuid}/`;

        return this.http
            .get<Profile>(url, {
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
     * Creates a new profile.
     *
     * @param createProfileForm - The profile data to be created.
     * @returns An Observable that emits the created profile.
     */
    createProfile(createProfileForm: Profile): Observable<Profile> {
        return this.http
            .post<Profile>(this.apiEndpointProfiles, createProfileForm, {
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
     * Deletes a profile by its UUID.
     *
     * @param uuid - The UUID of the profile to delete.
     * @returns An Observable that emits the response from the server.
     */
    deleteProfile(uuid: string): Observable<any> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointProfiles}${uuid}/`;

        return this.http
            .delete(url, {
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
     * Updates a profile with the given UUID.
     *
     * @param profile - The profile object to update.
     * @param uuid - The UUID of the profile to update.
     * @returns An Observable that emits the updated profile.
     */
    updateProfile(profile: Profile, uuid: string): Observable<Profile> {
        // Construct URL with placeholder
        const url = `${this.apiEndpointProfiles}${uuid}/`;

        return this.http
            .put<Profile>(url, profile, {
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
}
