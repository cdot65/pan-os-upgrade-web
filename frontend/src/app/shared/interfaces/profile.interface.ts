/* eslint-disable @typescript-eslint/naming-convention */

export interface Profile {
    authentication: {
        pan_username: string;
        pan_password: string;
    };
    description: string;
    download: {
        max_download_tries: number;
        download_retry_interval: number;
    };
    install: {
        max_install_attempts: number;
        install_retry_interval: number;
    };
    name: string;
    readiness_checks: {
        checks: {
            active_support: boolean;
            candidate_config: boolean;
            certificates_requirements: boolean;
            content_version: boolean;
            dynamic_updates: boolean;
            expired_licenses: boolean;
            free_disk_space: boolean;
            ha: boolean;
            jobs: boolean;
            ntp_sync: boolean;
            panorama: boolean;
            planes_clock_sync: boolean;
        };
    };
    reboot: {
        max_reboot_tries: number;
        reboot_retry_interval: number;
    };
    snapshots: {
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
    uuid: string;
}
