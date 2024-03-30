/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/services/settings.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import {
    Settings,
    SettingsApiResponse,
} from "../interfaces/settings.interface";

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment.prod";
import { map } from "rxjs/operators";

@Injectable({
    providedIn: "root",
})
export class SettingsService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    /**
     * Fetches the settings data from the API.
     * @returns An Observable that emits the settings data.
     */
    getSettings(): Observable<Settings> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<
                SettingsApiResponse[]
            >(`${this.apiUrl}/api/v1/settings/`, { headers })
            .pipe(
                map((response: SettingsApiResponse[]) => {
                    if (response.length > 0) {
                        return this.mapSettingsResponse(response[0]);
                    }
                    throw new Error("No settings data found");
                }),
            );
    }

    getProfiles(): Observable<string[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http.get<string[]>(
            `${this.apiUrl}/api/v1/settings/profiles/`,
            { headers },
        );
    }

    getSettingsByProfile(profile: string): Observable<Settings> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<SettingsApiResponse>(
                `${this.apiUrl}/api/v1/settings/?profile=${profile}`,
                { headers },
            )
            .pipe(
                map((response: SettingsApiResponse) =>
                    this.mapSettingsResponse(response),
                ),
            );
    }

    /**
     * Updates the settings data via the API.
     * @param settings - The settings data to update.
     * @returns An Observable that emits the updated settings data.
     */
    updateSettings(settings: Settings): Observable<Settings> {
        const apiSettings = this.mapSettingsToApiResponse(settings);
        return this.http
            .put<SettingsApiResponse>(this.apiUrl, apiSettings)
            .pipe(
                map((response: SettingsApiResponse) =>
                    this.mapSettingsResponse(response),
                ),
            );
    }

    /**
     * Maps the API response to the Settings interface.
     * @param response - The API response.
     * @returns The mapped Settings object.
     */
    private mapSettingsResponse(response: SettingsApiResponse): Settings {
        return {
            authentication: {
                panUsername: response.pan_username,
                panPassword: response.pan_password,
            },
            download: {
                maxDownloadTries: response.max_download_tries,
                downloadRetryInterval: response.download_retry_interval,
            },
            install: {
                maxInstallAttempts: response.max_install_attempts,
                installRetryInterval: response.install_retry_interval,
            },
            profile: response.profile,
            readinessChecks: {
                checks: {
                    activeSupportCheck: response.active_support_check,
                    arpEntryExistCheck: response.arp_entry_exist_check,
                    candidateConfigCheck: response.candidate_config_check,
                    certificatesRequirementsCheck:
                        response.certificates_requirements_check,
                    contentVersionCheck: response.content_version_check,
                    dynamicUpdatesCheck: response.dynamic_updates_check,
                    expiredLicensesCheck: response.expired_licenses_check,
                    freeDiskSpaceCheck: response.free_disk_space_check,
                    haCheck: response.ha_check,
                    ipSecTunnelStatusCheck: response.ip_sec_tunnel_status_check,
                    jobsCheck: response.jobs_check,
                    ntpSyncCheck: response.ntp_sync_check,
                    panoramaCheck: response.panorama_check,
                    planesClockSyncCheck: response.planes_clock_sync_check,
                    sessionExistCheck: response.session_exist_check,
                },
                readinessChecksLocation: response.readiness_checks_location,
            },
            reboot: {
                maxRebootTries: response.max_reboot_tries,
                rebootRetryInterval: response.reboot_retry_interval,
            },
            snapshots: {
                snapshotsLocation: response.snapshots_location,
                maxSnapshotTries: response.max_snapshot_tries,
                snapshotRetryInterval: response.snapshot_retry_interval,
                state: {
                    arpTableSnapshot: response.arp_table_snapshot,
                    contentVersionSnapshot: response.content_version_snapshot,
                    ipSecTunnelsSnapshot: response.ip_sec_tunnels_snapshot,
                    licenseSnapshot: response.license_snapshot,
                    nicsSnapshot: response.nics_snapshot,
                    routesSnapshot: response.routes_snapshot,
                    sessionStatsSnapshot: response.session_stats_snapshot,
                },
            },
            timeoutSettings: {
                commandTimeout: response.command_timeout,
                connectionTimeout: response.connection_timeout,
            },
            uuid: response.uuid,
        };
    }

    /**
     * Maps the Settings interface to the API request payload.
     * @param settings - The Settings object.
     * @returns The mapped API request payload.
     */
    private mapSettingsToApiResponse(settings: Settings): SettingsApiResponse {
        return {
            active_support_check:
                settings.readinessChecks.checks.activeSupportCheck,
            arp_entry_exist_check:
                settings.readinessChecks.checks.arpEntryExistCheck,
            arp_table_snapshot: settings.snapshots.state.arpTableSnapshot,
            candidate_config_check:
                settings.readinessChecks.checks.candidateConfigCheck,
            certificates_requirements_check:
                settings.readinessChecks.checks.certificatesRequirementsCheck,
            command_timeout: settings.timeoutSettings.commandTimeout,
            connection_timeout: settings.timeoutSettings.connectionTimeout,
            content_version_check:
                settings.readinessChecks.checks.contentVersionCheck,
            content_version_snapshot:
                settings.snapshots.state.contentVersionSnapshot,
            download_retry_interval: settings.download.downloadRetryInterval,
            dynamic_updates_check:
                settings.readinessChecks.checks.dynamicUpdatesCheck,
            expired_licenses_check:
                settings.readinessChecks.checks.expiredLicensesCheck,
            free_disk_space_check:
                settings.readinessChecks.checks.freeDiskSpaceCheck,
            ha_check: settings.readinessChecks.checks.haCheck,
            install_retry_interval: settings.install.installRetryInterval,
            ip_sec_tunnels_snapshot:
                settings.snapshots.state.ipSecTunnelsSnapshot,
            ip_sec_tunnel_status_check:
                settings.readinessChecks.checks.ipSecTunnelStatusCheck,
            jobs_check: settings.readinessChecks.checks.jobsCheck,
            license_snapshot: settings.snapshots.state.licenseSnapshot,
            max_download_tries: settings.download.maxDownloadTries,
            max_install_attempts: settings.install.maxInstallAttempts,
            max_reboot_tries: settings.reboot.maxRebootTries,
            max_snapshot_tries: settings.snapshots.maxSnapshotTries,
            nics_snapshot: settings.snapshots.state.nicsSnapshot,
            ntp_sync_check: settings.readinessChecks.checks.ntpSyncCheck,
            pan_username: settings.authentication.panUsername,
            pan_password: settings.authentication.panPassword,
            panorama_check: settings.readinessChecks.checks.panoramaCheck,
            planes_clock_sync_check:
                settings.readinessChecks.checks.planesClockSyncCheck,
            profile: settings.profile,
            readiness_checks_location:
                settings.readinessChecks.readinessChecksLocation,
            reboot_retry_interval: settings.reboot.rebootRetryInterval,
            routes_snapshot: settings.snapshots.state.routesSnapshot,
            session_exist_check:
                settings.readinessChecks.checks.sessionExistCheck,
            session_stats_snapshot:
                settings.snapshots.state.sessionStatsSnapshot,
            snapshot_retry_interval: settings.snapshots.snapshotRetryInterval,
            snapshots_location: settings.snapshots.snapshotsLocation,
            uuid: settings.uuid,
        };
    }
}
