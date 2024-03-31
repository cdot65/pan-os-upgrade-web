/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/services/settings.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import {
    SettingsProfile,
    SettingsProfileApiResponse,
} from "../interfaces/settings-profile.interface";
import { catchError, map } from "rxjs/operators";

import { Injectable } from "@angular/core";
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
            .get<SettingsProfileApiResponse>(
                `${this.apiUrl}/api/v1/settings/?profile=${profile}`,
                { headers },
            )
            .pipe(
                map((response: SettingsProfileApiResponse) =>
                    this.mapApiResponseToSettingsProfile(response),
                ),
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

    /**
     * Updates the settings data via the API.
     * @param settings - The settings data to update.
     * @returns An Observable that emits the updated settings data.
     */
    updateSettings(settings: SettingsProfile): Observable<SettingsProfile> {
        const apiSettings = this.mapSettingsProfileToApiRequest(settings);
        return this.http
            .put<SettingsProfileApiResponse>(this.apiUrl, apiSettings)
            .pipe(
                map((response: SettingsProfileApiResponse) =>
                    this.mapApiResponseToSettingsProfile(response),
                ),
            );
    }

    /**
     * Maps the API response to the SettingsProfile interface.
     * @param response - The API response.
     * @returns The mapped SettingsProfile object.
     */
    private mapApiResponseToSettingsProfile(
        response: SettingsProfileApiResponse,
    ): SettingsProfile {
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
     * Maps the SettingsProfile interface to the API request payload.
     * @param settings - The SettingsProfile object.
     * @returns The mapped API request payload.
     */
    private mapSettingsProfileToApiRequest(
        settings: SettingsProfile,
    ): SettingsProfileApiResponse {
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
