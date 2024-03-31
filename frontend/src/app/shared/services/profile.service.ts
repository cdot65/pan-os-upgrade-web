/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/services/settings.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, tap } from "rxjs/operators";

import { Injectable } from "@angular/core";
import { Profile } from "../interfaces/profile.interface";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class ProfileService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    getProfiles(): Observable<Profile[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.get<Profile[]>(`${this.apiUrl}/api/v1/profiles/`, {
            headers,
        });
    }

    getProfile(uuid: string): Observable<Profile> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<Profile>(`${this.apiUrl}/api/v1/profiles/${uuid}/`, {
                headers,
            })
            .pipe(
                tap((response: Profile) => {
                    console.log("API Response:", response);
                }),
            );
    }

    createProfile(profileForm: Profile): Observable<Profile> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .post<Profile>(`${this.apiUrl}/api/v1/profiles/`, profileForm, {
                headers,
            })
            .pipe(
                tap((response: Profile) => {
                    console.log("API Response:", response);
                }),
            );
    }

    deleteProfile(uuid: string): Observable<any> {
        const authToken = localStorage.getItem("auth_token");
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

    updateProfile(profileForm: Profile): Observable<Profile> {
        return this.http
            .put<Profile>(
                `${this.apiUrl}/api/v1/profiles/${profileForm.uuid}/`,
                profileForm,
            )
            .pipe(
                tap((response: Profile) => {
                    console.log("API Response:", response);
                }),
            );
    }
}
