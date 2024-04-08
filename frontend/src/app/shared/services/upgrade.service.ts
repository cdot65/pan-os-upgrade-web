// src/app/shared/services/upgrade.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { CancelUpgradeResponse } from "../interfaces/cancel-upgrade-response.interface";
import { Injectable } from "@angular/core";
import { UpgradeForm } from "../interfaces/upgrade-form.interface";
import { UpgradeHistory } from "../interfaces/upgrade-history.interface";
import { UpgradeStatus } from "../interfaces/upgrade-status.interface";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class UpgradeService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    upgradeDevice(upgradeForm: UpgradeForm): Observable<string | null> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .post<{ jobId: string }>(
                `${this.apiUrl}/api/v1/upgrade/`,
                upgradeForm,
                {
                    headers,
                },
            )
            .pipe(
                map((response) => response.jobId || null),
                catchError((error) => {
                    console.error("Error upgrading device:", error);
                    return of(null);
                }),
            );
    }

    getUpgradeHistory(deviceId: string): Observable<UpgradeHistory[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.get<UpgradeHistory[]>(
            `${this.apiUrl}/api/v1/upgrade/history/${deviceId}`,
            { headers },
        );
    }

    getUpgradeStatus(jobId: string): Observable<UpgradeStatus> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.get<UpgradeStatus>(
            `${this.apiUrl}/api/v1/upgrade/status/${jobId}`,
            { headers },
        );
    }

    cancelUpgrade(jobId: string): Observable<CancelUpgradeResponse> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.post<CancelUpgradeResponse>(
            `${this.apiUrl}/api/v1/upgrade/cancel/${jobId}`,
            {},
            { headers },
        );
    }
}
