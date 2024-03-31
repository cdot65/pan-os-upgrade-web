/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/services/settings.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, tap } from "rxjs/operators";

import { Injectable } from "@angular/core";
import { SettingsProfile } from "../interfaces/settings-profile.interface";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class SettingsProfileService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    getProfiles(): Observable<SettingsProfile[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.get<SettingsProfile[]>(
            `${this.apiUrl}/api/v1/settings/profiles/`,
            { headers },
        );
    }

    getSettingsByProfile(profile: string): Observable<SettingsProfile> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<SettingsProfile>(
                `${this.apiUrl}/api/v1/settings/profiles/${profile}/`,
                { headers },
            )
            .pipe(
                tap((response: SettingsProfile) => {
                    console.log("API Response:", response);
                }),
            );
    }

    /**
     * Deletes an inventory item by its UUID.
     * @param uuid The UUID of the inventory item to delete.
     * @returns An Observable that emits the response from the server, or null if an error occurs.
     */
    deleteSettingsProfile(uuid: number): Observable<any> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .delete(`${this.apiUrl}/api/v1/settings/profiles/${uuid}`, {
                headers,
            })
            .pipe(
                catchError((error) => {
                    console.error("Error deleting settings profile:", error);
                    return of(null);
                }),
            );
    }

    updateSettingsProfile(
        settings: SettingsProfile,
    ): Observable<SettingsProfile> {
        return this.http
            .put<SettingsProfile>(
                `${this.apiUrl}/api/v1/settings/profiles/${settings.uuid}/`,
                settings,
            )
            .pipe(
                tap((response: SettingsProfile) => {
                    console.log("API Response:", response);
                }),
            );
    }
}
