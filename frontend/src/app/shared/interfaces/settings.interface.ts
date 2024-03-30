// src/app/shared/interfaces/settings.interface.ts

export interface Settings {
    concurrency: {
        threads: number;
    };
    download: {
        maxTries: number;
        retryInterval: number;
    };
    install: {
        maxTries: number;
        retryInterval: number;
    };
    logging: {
        filePath: string;
        level: string;
        maxSize: number;
        upgradeLogCount: number;
    };
    readinessChecks: {
        checks: {
            activeSupport: boolean;
            arpEntryExist: boolean;
            candidateConfig: boolean;
            certificatesRequirements: boolean;
            contentVersion: boolean;
            dynamicUpdates: boolean;
            expiredLicenses: boolean;
            freeDiskSpace: boolean;
            ha: boolean;
            ipSecTunnelStatus: boolean;
            jobs: boolean;
            ntpSync: boolean;
            panorama: boolean;
            planesClockSync: boolean;
            sessionExist: boolean;
        };
        customize: boolean;
        disabled: boolean;
        location: string;
    };
    reboot: {
        maxTries: number;
        retryInterval: number;
    };
    snapshots: {
        customize: boolean;
        disabled: boolean;
        location: string;
        maxTries: number;
        retryInterval: number;
        state: {
            arpTable: boolean;
            contentVersion: boolean;
            ipSecTunnels: boolean;
            license: boolean;
            nics: boolean;
            routes: boolean;
            sessionStats: boolean;
        };
    };
    timeoutSettings: {
        commandTimeout: number;
        connectionTimeout: number;
    };
}
