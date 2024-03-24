// src/app/shared/services/auth.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";

import { CookieService } from "ngx-cookie-service";
import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { environment } from "../../../environments/environment";
import { map } from "rxjs/operators";

@Injectable({
    providedIn: "root",
})
export class AuthService {
    private apiUrl = environment.apiUrl;
    private tokenUrl = environment.tokenUrl;
    private registrationUrl =
        environment.apiUrl + "/api/v1/dj-rest-auth/registration/";
    private userProfileUrl = environment.apiUrl + "/api/v1/dj-rest-auth/user/";

    constructor(
        private http: HttpClient,
        private router: Router,
        private cookieService: CookieService,
    ) {}

    login(username: string, password: string) {
        const headers = new HttpHeaders().set(
            "Content-Type",
            "application/json",
        );
        const body = JSON.stringify({ username, password });

        return this.http.post<any>(`${this.apiUrl}${this.tokenUrl}`, body, {
            headers,
        });
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
        return this.http.post<any>(this.registrationUrl, body, {
            headers,
        });
    }

    getUserProfile() {
        return this.http.get<any>(this.userProfileUrl);
    }

    logout(): void {
        this.cookieService.delete("auth_token");
        this.router.navigate(["/auth/login"]);
    }

    getUserData() {
        const authToken = this.cookieService.get("auth_token");
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
