/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/services/settings.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import {
    SettingsProfile,
    SettingsProfileApiResponse,
} from "../interfaces/settings-profile.interface";
import { catchError, map, tap } from "rxjs/operators";

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
                `${this.apiUrl}/api/v1/settings/profiles/${profile}/`,
                { headers },
            )
            .pipe(
                tap((response: SettingsProfileApiResponse) => {
                    console.log("API Response:", response);
                }),
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
    updateSettingsProfile(
        settings: SettingsProfile,
    ): Observable<SettingsProfile> {
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
        const settingsProfile: SettingsProfile = {
            authentication: {
                panUsername: response.authentication.pan_username,
                panPassword: response.authentication.pan_password,
            },
            description: response.description,
            download: {
                maxDownloadTries: response.download.max_download_tries,
                downloadRetryInterval:
                    response.download.download_retry_interval,
            },
            install: {
                maxInstallAttempts: response.install.max_install_attempts,
                installRetryInterval: response.install.install_retry_interval,
            },
            profile: response.profile,
            readinessChecks: {
                checks: {
                    activeSupportCheck:
                        response.readiness_checks.checks.active_support_check,
                    arpEntryExistCheck:
                        response.readiness_checks.checks.arp_entry_exist_check,
                    candidateConfigCheck:
                        response.readiness_checks.checks.candidate_config_check,
                    certificatesRequirementsCheck:
                        response.readiness_checks.checks
                            .certificates_requirements_check,
                    contentVersionCheck:
                        response.readiness_checks.checks.content_version_check,
                    dynamicUpdatesCheck:
                        response.readiness_checks.checks.dynamic_updates_check,
                    expiredLicensesCheck:
                        response.readiness_checks.checks.expired_licenses_check,
                    freeDiskSpaceCheck:
                        response.readiness_checks.checks.free_disk_space_check,
                    haCheck: response.readiness_checks.checks.ha_check,
                    ipSecTunnelStatusCheck:
                        response.readiness_checks.checks
                            .ip_sec_tunnel_status_check,
                    jobsCheck: response.readiness_checks.checks.jobs_check,
                    ntpSyncCheck:
                        response.readiness_checks.checks.ntp_sync_check,
                    panoramaCheck:
                        response.readiness_checks.checks.panorama_check,
                    planesClockSyncCheck:
                        response.readiness_checks.checks
                            .planes_clock_sync_check,
                    sessionExistCheck:
                        response.readiness_checks.checks.session_exist_check,
                },
                readinessChecksLocation:
                    response.readiness_checks.readiness_checks_location,
            },
            reboot: {
                maxRebootTries: response.reboot.max_reboot_tries,
                rebootRetryInterval: response.reboot.reboot_retry_interval,
            },
            snapshots: {
                snapshotsLocation: response.snapshots.snapshots_location,
                maxSnapshotTries: response.snapshots.max_snapshot_tries,
                snapshotRetryInterval:
                    response.snapshots.snapshot_retry_interval,
                state: {
                    arpTableSnapshot:
                        response.snapshots.state.arp_table_snapshot,
                    contentVersionSnapshot:
                        response.snapshots.state.content_version_snapshot,
                    ipSecTunnelsSnapshot:
                        response.snapshots.state.ip_sec_tunnels_snapshot,
                    licenseSnapshot: response.snapshots.state.license_snapshot,
                    nicsSnapshot: response.snapshots.state.nics_snapshot,
                    routesSnapshot: response.snapshots.state.routes_snapshot,
                    sessionStatsSnapshot:
                        response.snapshots.state.session_stats_snapshot,
                },
            },
            timeoutSettings: {
                commandTimeout: response.timeout_settings.command_timeout,
                connectionTimeout: response.timeout_settings.connection_timeout,
            },
            uuid: response.uuid,
        };
        console.log("Mapped SettingsProfile:", settingsProfile);
        return settingsProfile;
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
            authentication: {
                pan_username: settings.authentication.panUsername,
                pan_password: settings.authentication.panPassword,
            },
            description: settings.description,
            download: {
                max_download_tries: settings.download.maxDownloadTries,
                download_retry_interval:
                    settings.download.downloadRetryInterval,
            },
            install: {
                max_install_attempts: settings.install.maxInstallAttempts,
                install_retry_interval: settings.install.installRetryInterval,
            },
            profile: settings.profile,
            readiness_checks: {
                checks: {
                    active_support_check:
                        settings.readinessChecks.checks.activeSupportCheck,
                    arp_entry_exist_check:
                        settings.readinessChecks.checks.arpEntryExistCheck,
                    candidate_config_check:
                        settings.readinessChecks.checks.candidateConfigCheck,
                    certificates_requirements_check:
                        settings.readinessChecks.checks
                            .certificatesRequirementsCheck,
                    content_version_check:
                        settings.readinessChecks.checks.contentVersionCheck,
                    dynamic_updates_check:
                        settings.readinessChecks.checks.dynamicUpdatesCheck,
                    expired_licenses_check:
                        settings.readinessChecks.checks.expiredLicensesCheck,
                    free_disk_space_check:
                        settings.readinessChecks.checks.freeDiskSpaceCheck,
                    ha_check: settings.readinessChecks.checks.haCheck,
                    ip_sec_tunnel_status_check:
                        settings.readinessChecks.checks.ipSecTunnelStatusCheck,
                    jobs_check: settings.readinessChecks.checks.jobsCheck,
                    ntp_sync_check:
                        settings.readinessChecks.checks.ntpSyncCheck,
                    panorama_check:
                        settings.readinessChecks.checks.panoramaCheck,
                    planes_clock_sync_check:
                        settings.readinessChecks.checks.planesClockSyncCheck,
                    session_exist_check:
                        settings.readinessChecks.checks.sessionExistCheck,
                },
                readiness_checks_location:
                    settings.readinessChecks.readinessChecksLocation,
            },
            reboot: {
                max_reboot_tries: settings.reboot.maxRebootTries,
                reboot_retry_interval: settings.reboot.rebootRetryInterval,
            },
            snapshots: {
                snapshots_location: settings.snapshots.snapshotsLocation,
                max_snapshot_tries: settings.snapshots.maxSnapshotTries,
                snapshot_retry_interval:
                    settings.snapshots.snapshotRetryInterval,
                state: {
                    arp_table_snapshot:
                        settings.snapshots.state.arpTableSnapshot,
                    content_version_snapshot:
                        settings.snapshots.state.contentVersionSnapshot,
                    ip_sec_tunnels_snapshot:
                        settings.snapshots.state.ipSecTunnelsSnapshot,
                    license_snapshot: settings.snapshots.state.licenseSnapshot,
                    nics_snapshot: settings.snapshots.state.nicsSnapshot,
                    routes_snapshot: settings.snapshots.state.routesSnapshot,
                    session_stats_snapshot:
                        settings.snapshots.state.sessionStatsSnapshot,
                },
            },
            timeout_settings: {
                command_timeout: settings.timeoutSettings.commandTimeout,
                connection_timeout: settings.timeoutSettings.connectionTimeout,
            },
            uuid: settings.uuid,
        };
    }
}
