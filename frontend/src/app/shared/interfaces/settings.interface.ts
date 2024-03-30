// src/app/shared/interfaces/settings.interface.ts

export interface Settings {
    download: {
        maxDownloadTries: number;
        downloadRetryInterval: number;
    };
    install: {
        maxInstallAttempts: number;
        installRetryInterval: number;
    };
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
}
