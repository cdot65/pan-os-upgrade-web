/* eslint-disable max-len */
// src/app/shared/services/auth.service.ts

// Import your custom error classes
import {
    AuthError,
    InvalidCredentialsError,
    RegistrationError,
} from "../errors/auth.error";
import { BehaviorSubject, Observable, throwError, timer } from "rxjs";
import {
    HttpClient,
    HttpErrorResponse,
    HttpHeaders,
} from "@angular/common/http";
import { catchError, map, mergeMap, retryWhen, tap } from "rxjs/operators";

import { CookieService } from "ngx-cookie-service";
import { Injectable } from "@angular/core";
import { LoginResponse } from "../interfaces/login-response";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { environment } from "../../../environments/environment";

@Injectable({
    providedIn: "root",
})
export class AuthService {
    // Define the API endpoints
    private apiUrl = environment.apiUrl;
    private apiEndpointToken = this.apiUrl + environment.apiEndpointToken;
    private apiEndpointRegistration = `${this.apiUrl}/api/v1/dj-rest-auth/registration/`;
    private apiEndpointUserProfile = `${this.apiUrl}/api/v1/dj-rest-auth/user/`;

    // BehaviorSubject to keep track of the login status
    private isLoggedInSubject = new BehaviorSubject<boolean>(false);
    isLoggedIn$: Observable<boolean>;

    /**
     * Represents the AuthService class that handles authentication-related functionality.
     */
    constructor(
        private http: HttpClient,
        private router: Router,
        private snackBar: MatSnackBar,
        private cookieService: CookieService,
    ) {
        this.isLoggedIn$ = this.isLoggedInSubject.asObservable();
        const token = this.cookieService.get("auth_token");
        this.isLoggedInSubject.next(!!token);
    }

    /**
     * Retrieves the HttpHeaders object with the Authorization token.
     * If a token is provided, it will be used. Otherwise, it will attempt to retrieve the token from local storage.
     * If no token is found, an empty HttpHeaders object will be returned.
     *
     * @param token - The authorization token (optional)
     * @returns The HttpHeaders object with the Authorization token
     */
    private getAuthHeaders(): HttpHeaders {
        const authToken = this.cookieService.get("auth_token");
        if (authToken) {
            return new HttpHeaders().set("Authorization", `Token ${authToken}`);
        } else {
            return new HttpHeaders();
        }
    }

    /**
     * Handles the error response from an HTTP request.
     *
     * @param error - The error response from the HTTP request.
     * @returns An Observable that emits the error.
     */
    private handleError(error: HttpErrorResponse): Observable<never> {
        let authError: AuthError;

        // Check if the error is a client-side or network error
        if (error.error instanceof ErrorEvent) {
            // A client-side or network error occurred.
            authError = new AuthError(
                error.error,
                `An error occurred: ${error.error.message}`,
            );
        } else {
            // The backend returned an unsuccessful response code.
            switch (error.status) {
                case 400: {
                    // Check for the specific login error message
                    if (
                        error.error &&
                        error.error.non_field_errors &&
                        error.error.non_field_errors.includes(
                            "Unable to log in with provided credentials.",
                        )
                    ) {
                        // Extract the specific error message from the response payload
                        const errorMessage = error.error.non_field_errors[0];
                        authError = new InvalidCredentialsError(
                            error,
                            errorMessage,
                        );
                    } else if (
                        error.url?.includes(this.apiEndpointRegistration)
                    ) {
                        authError = new RegistrationError(error);
                    } else {
                        authError = new AuthError(
                            error,
                            `Bad Request: ${JSON.stringify(error.error)}`,
                        );
                    }
                    break;
                }
                default:
                    authError = new AuthError(
                        error,
                        `Backend returned code ${error.status}, body was: ${JSON.stringify(error.error)}`,
                    );
            }
        }

        // Display the error message in a snackbar
        this.snackBar.open(authError.message, "Close", {
            duration: 5000,
            verticalPosition: "bottom",
        });

        // Return the error
        return throwError(() => authError);
    }

    /**
     * Logs in the user with the provided username and password.
     *
     * @param username - The username of the user.
     * @param password - The password of the user.
     * @returns An Observable that emits the response from the login request.
     */
    login(username: string, password: string) {
        const headers = new HttpHeaders().set(
            "Content-Type",
            "application/json",
        );
        const body = JSON.stringify({ username, password });

        return this.http
            .post<LoginResponse>(this.apiEndpointToken, body, { headers })
            .pipe(
                tap((response) => {
                    if (response && response.key) {
                        const expirationTime = new Date();
                        expirationTime.setHours(expirationTime.getHours() + 1); // Expires in 1 hour
                        this.cookieService.set(
                            "auth_token",
                            response.key,
                            expirationTime,
                            "/",
                        );
                        this.cookieService.set(
                            "author",
                            response.author,
                            expirationTime,
                            "/",
                        );
                        this.isLoggedInSubject.next(true);
                    }
                }),
                retryWhen((errors) =>
                    errors.pipe(
                        mergeMap((error: HttpErrorResponse, i) => {
                            const retryAttempt = i + 1;
                            if (retryAttempt <= 3 && error.status >= 500) {
                                const delayTime =
                                    Math.pow(2, retryAttempt) * 1000;
                                return timer(delayTime);
                            } else {
                                return throwError(error);
                            }
                        }),
                    ),
                ),
                catchError(this.handleError.bind(this)),
            );
    }

    /**
     * Registers a new user.
     *
     * @param username - The username of the user.
     * @param email - The email address of the user.
     * @param password1 - The password of the user.
     * @param password2 - The confirmation password of the user.
     * @returns An Observable that emits the response from the server.
     */
    register(
        username: string,
        email: string,
        password1: string,
        password2: string,
    ) {
        const headers = new HttpHeaders().set(
            "Content-Type",
            "application/json",
        );
        const body = JSON.stringify({ username, email, password1, password2 });
        return this.http
            .post<any>(this.apiEndpointRegistration, body, { headers })
            .pipe(catchError(this.handleError.bind(this)));
    }

    /**
     * Retrieves the user profile from the server.
     *
     * @returns An Observable that emits the user profile data.
     */
    getUserProfile() {
        return this.http
            .get<any>(this.apiEndpointUserProfile, {
                headers: this.getAuthHeaders(),
            })
            .pipe(catchError(this.handleError.bind(this)));
    }

    /**
     * Logs out the user by removing the authentication token from local storage,
     * updating the login status, and navigating to the login page.
     */
    logout(): void {
        this.cookieService.delete("auth_token", "/");
        this.cookieService.delete("author", "/");
        this.isLoggedInSubject.next(false);
        this.router.navigate(["/auth/login"]);
    }

    /**
     * Retrieves user data from the server.
     *
     * @returns An Observable that emits the user data.
     */
    getUserData() {
        return this.http
            .get(this.apiEndpointUserProfile, {
                headers: this.getAuthHeaders(),
            })
            .pipe(
                map((response: any) => ({
                    ...response,
                    pk: Number(response.pk),
                })),
                catchError(this.handleError.bind(this)),
            );
    }
}
