/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/services/settings.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";

import { CookieService } from "ngx-cookie-service";
import { Injectable } from "@angular/core";
import { Profile } from "../interfaces/profile.interface";
import { catchError } from "rxjs/operators";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class ProfileService {
    private apiUrl = environment.apiUrl;

    constructor(
        private http: HttpClient,
        private cookieService: CookieService,
    ) {}

    getProfiles(): Observable<Profile[]> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.get<Profile[]>(`${this.apiUrl}/api/v1/profiles/`, {
            headers,
        });
    }

    getProfile(uuid: string): Observable<Profile> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.get<Profile>(
            `${this.apiUrl}/api/v1/profiles/${uuid}/`,
            {
                headers,
            },
        );
    }

    createProfile(createProfileForm: Profile): Observable<Profile> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.post<Profile>(
            `${this.apiUrl}/api/v1/profiles/`,
            createProfileForm,
            {
                headers,
            },
        );
    }

    deleteProfile(uuid: string): Observable<any> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .delete(`${this.apiUrl}/api/v1/profiles/${uuid}`, {
                headers,
            })
            .pipe(
                catchError((error) => {
                    console.error("Error deleting profile:", error);
                    return of(null);
                }),
            );
    }

    updateProfile(profile: Profile, uuid: string): Observable<Profile> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .put<Profile>(`${this.apiUrl}/api/v1/profiles/${uuid}/`, profile, {
                headers,
            })
            .pipe(
                catchError((error: any) => {
                    console.error("Error updating profile:", error);
                    throw error;
                }),
            );
    }
}
