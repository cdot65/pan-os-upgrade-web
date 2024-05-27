// src/app/shared/services/upgrade.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";

import { CancelUpgradeResponse } from "../interfaces/cancel-upgrade-response.interface";
import { CookieService } from "ngx-cookie-service";
import { Injectable } from "@angular/core";
import { UpgradeForm } from "../interfaces/upgrade-form.interface";
import { UpgradeHistory } from "../interfaces/upgrade-history.interface";
import { UpgradeResponse } from "../interfaces/upgrade-response.interface";
import { UpgradeStatus } from "../interfaces/upgrade-status.interface";
import { catchError } from "rxjs/operators";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class UpgradeService {
    private apiUrl = environment.apiUrl;

    constructor(
        private http: HttpClient,
        private cookieService: CookieService,
    ) {}

    upgradeDevice(
        upgradeForm: UpgradeForm,
    ): Observable<UpgradeResponse | null> {
        const authToken = this.cookieService.get("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .post<UpgradeResponse>(
                `${this.apiUrl}/api/v1/inventory/upgrade/`,
                upgradeForm,
                {
                    headers,
                },
            )
            .pipe(
                catchError((error) => {
                    console.error("Error upgrading device:", error);
                    return of(null);
                }),
            );
    }

    getUpgradeHistory(deviceId: string): Observable<UpgradeHistory[]> {
        const authToken = this.cookieService.get("auth_token");
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
        const authToken = this.cookieService.get("auth_token");
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
        const authToken = this.cookieService.get("auth_token");
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
