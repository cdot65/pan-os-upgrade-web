/* eslint-disable @typescript-eslint/naming-convention */
// src/app/shared/interfaces/settings.interface.ts

export interface SettingsProfile {
    authentication: {
        panUsername: string;
        panPassword: string;
    };
    description: string;
    download: {
        maxDownloadTries: number;
        downloadRetryInterval: number;
    };
    install: {
        maxInstallAttempts: number;
        installRetryInterval: number;
    };
    profile: string;
    readinessChecks: {
        checks: {
            activeSupportCheck: boolean;
            arpEntryExistCheck: boolean;
            candidateConfigCheck: boolean;
            certificatesRequirementsCheck: boolean;
            contentVersionCheck: boolean;
            dynamicUpdatesCheck: boolean;
            expiredLicensesCheck: boolean;
            freeDiskSpaceCheck: boolean;
            haCheck: boolean;
            ipSecTunnelStatusCheck: boolean;
            jobsCheck: boolean;
            ntpSyncCheck: boolean;
            panoramaCheck: boolean;
            planesClockSyncCheck: boolean;
            sessionExistCheck: boolean;
        };
        readinessChecksLocation: string;
    };
    reboot: {
        maxRebootTries: number;
        rebootRetryInterval: number;
    };
    snapshots: {
        snapshotsLocation: string;
        maxSnapshotTries: number;
        snapshotRetryInterval: number;
        state: {
            arpTableSnapshot: boolean;
            contentVersionSnapshot: boolean;
            ipSecTunnelsSnapshot: boolean;
            licenseSnapshot: boolean;
            nicsSnapshot: boolean;
            routesSnapshot: boolean;
            sessionStatsSnapshot: boolean;
        };
    };
    timeoutSettings: {
        commandTimeout: number;
        connectionTimeout: number;
    };
    uuid: number;
}

export interface SettingsProfileApiResponse {
    active_support_check: boolean;
    arp_entry_exist_check: boolean;
    arp_table_snapshot: boolean;
    candidate_config_check: boolean;
    certificates_requirements_check: boolean;
    command_timeout: number;
    connection_timeout: number;
    content_version_check: boolean;
    content_version_snapshot: boolean;
    description: string;
    download_retry_interval: number;
    dynamic_updates_check: boolean;
    expired_licenses_check: boolean;
    free_disk_space_check: boolean;
    ha_check: boolean;
    install_retry_interval: number;
    ip_sec_tunnel_status_check: boolean;
    ip_sec_tunnels_snapshot: boolean;
    jobs_check: boolean;
    license_snapshot: boolean;
    max_download_tries: number;
    max_install_attempts: number;
    max_reboot_tries: number;
    max_snapshot_tries: number;
    nics_snapshot: boolean;
    ntp_sync_check: boolean;
    pan_password: string;
    pan_username: string;
    panorama_check: boolean;
    planes_clock_sync_check: boolean;
    profile: string;
    readiness_checks_location: string;
    reboot_retry_interval: number;
    routes_snapshot: boolean;
    session_exist_check: boolean;
    session_stats_snapshot: boolean;
    snapshot_retry_interval: number;
    snapshots_location: string;
    uuid: number;
}
