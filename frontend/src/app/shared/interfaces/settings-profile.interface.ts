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
    uuid: number;
    description: string;
    profile: string;
    authentication: {
        pan_username: string;
        pan_password: string;
    };
    download: {
        max_download_tries: number;
        download_retry_interval: number;
    };
    install: {
        max_install_attempts: number;
        install_retry_interval: number;
    };
    readiness_checks: {
        checks: {
            active_support_check: boolean;
            arp_entry_exist_check: boolean;
            candidate_config_check: boolean;
            certificates_requirements_check: boolean;
            content_version_check: boolean;
            dynamic_updates_check: boolean;
            expired_licenses_check: boolean;
            free_disk_space_check: boolean;
            ha_check: boolean;
            ip_sec_tunnel_status_check: boolean;
            jobs_check: boolean;
            ntp_sync_check: boolean;
            panorama_check: boolean;
            planes_clock_sync_check: boolean;
            session_exist_check: boolean;
        };
        readiness_checks_location: string;
    };
    reboot: {
        max_reboot_tries: number;
        reboot_retry_interval: number;
    };
    snapshots: {
        snapshots_location: string;
        max_snapshot_tries: number;
        snapshot_retry_interval: number;
        state: {
            arp_table_snapshot: boolean;
            content_version_snapshot: boolean;
            ip_sec_tunnels_snapshot: boolean;
            license_snapshot: boolean;
            nics_snapshot: boolean;
            routes_snapshot: boolean;
            session_stats_snapshot: boolean;
        };
    };
    timeout_settings: {
        command_timeout: number;
        connection_timeout: number;
    };
}
