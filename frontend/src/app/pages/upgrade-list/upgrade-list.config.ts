/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/upgrade-list/upgrade-list.config.ts

export const UPGRADE_LIST_CONFIG = {
    pageTitle: "Upgrade Devices",
    pageDescription: "Upgrade your PAN-OS devices to the latest version",
    breadcrumbs: [
        { label: "Home", url: "/" },
        { label: "Upgrades", url: "/upgrades" },
    ],
    snackBarDuration: 3000,
    pollingInterval: 2000,
    pollingTimeout: 300000, // 5 minutes
    maxRetries: 3,
    errorMessages: {
        fetchDevicesFailed: "Failed to fetch devices. Please try again.",
        fetchProfilesFailed: "Failed to fetch profiles. Please try again.",
        fetchVersionsFailed:
            "Failed to fetch PAN-OS versions. Please try again.",
        upgradeInitiateFailed:
            "Failed to initiate the upgrade. Please try again.",
        syncVersionsFailed: "Failed to sync PAN-OS versions. Please try again.",
        selectDeviceAndProfile:
            "Please select at least one device and a profile before syncing versions.",
    },
};
