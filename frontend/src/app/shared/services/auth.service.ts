// src/app/shared/services/auth.service.ts

import { BehaviorSubject, Observable } from "rxjs";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { map, tap } from "rxjs/operators";

import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { environment } from "../../../environments/environment";

@Injectable({
    providedIn: "root",
})
export class AuthService {
    private apiUrl = environment.apiUrl;
    private tokenUrl = this.apiUrl + environment.tokenUrl;
    private registrationUrl =
        environment.apiUrl + "/api/v1/dj-rest-auth/registration/";
    private userProfileUrl = environment.apiUrl + "/api/v1/dj-rest-auth/user/";
    private isLoggedInSubject = new BehaviorSubject<boolean>(false);
    isLoggedIn$: Observable<boolean>;

    constructor(
        private http: HttpClient,
        private router: Router,
    ) {
        this.isLoggedIn$ = this.isLoggedInSubject.asObservable();
        const token = localStorage.getItem("auth_token");
        this.isLoggedInSubject.next(!!token);
    }

    login(username: string, password: string) {
        const headers = new HttpHeaders().set(
            "Content-Type",
            "application/json",
        );
        const body = JSON.stringify({ username, password });

        return this.http.post<any>(`${this.tokenUrl}`, body, { headers }).pipe(
            tap((response) => {
                console.log("Login response:", response); // Log the response object
                if (response && response.key) {
                    // Check if the token is present in the response
                    localStorage.setItem("auth_token", response.key);
                    localStorage.setItem("author", response.author);
                    this.isLoggedInSubject.next(true);
                } else {
                    console.error("Token not found in the response");
                }
            }),
        );
    }

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
        console.log("Register request body:", body);
        return this.http.post<any>(this.registrationUrl, body, { headers });
    }

    getUserProfile() {
        return this.http.get<any>(this.userProfileUrl);
    }

    logout(): void {
        localStorage.removeItem("auth_token");
        this.router.navigate(["/auth/login"]);
    }

    getUserData() {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );

        return this.http
            .get(`${this.apiUrl}/api/v1/dj-rest-auth/user/`, { headers })
            .pipe(
                map((response: any) => ({
                    ...response,
                    pk: Number(response.pk),
                })),
            );
    }
}
