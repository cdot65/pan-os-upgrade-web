// src/app/shared/services/auth.service.ts

import * as CryptoJS from "crypto-js";

import { BehaviorSubject, Observable } from "rxjs";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { map, tap } from "rxjs/operators";

import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { environment } from "../../../environments/environment";

const TOKEN_KEY = "auth_token";
const secretKey = "your-secret-key";

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
        this.isLoggedInSubject.next(this.checkAuthToken());
    }

    private encryptToken(token: string): string {
        return CryptoJS.AES.encrypt(token, secretKey).toString();
    }

    private decryptToken(encryptedToken: string): string {
        const bytes = CryptoJS.AES.decrypt(encryptedToken, secretKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    }

    private setAuthToken(token: string) {
        const encryptedToken = this.encryptToken(token);
        localStorage.setItem(TOKEN_KEY, encryptedToken);
    }

    private getAuthToken(): string | null {
        const encryptedToken = localStorage.getItem(TOKEN_KEY);
        if (encryptedToken) {
            return this.decryptToken(encryptedToken);
        }
        return null;
    }

    private removeAuthToken() {
        localStorage.removeItem(TOKEN_KEY);
    }

    private checkAuthToken(): boolean {
        return !!this.getAuthToken();
    }

    login(username: string, password: string) {
        const headers = new HttpHeaders().set(
            "Content-Type",
            "application/json",
        );
        const body = JSON.stringify({ username, password });

        return this.http.post<any>(`${this.tokenUrl}`, body, { headers }).pipe(
            tap((response) => {
                this.setAuthToken(response.key);
                this.isLoggedInSubject.next(true);
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
        this.removeAuthToken();
        this.isLoggedInSubject.next(false);
        this.router.navigate(["/auth/login"]);
    }

    getUserData() {
        const authToken = this.getAuthToken();
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
