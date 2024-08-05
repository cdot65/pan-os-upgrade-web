/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/inventory-list/inventory-list.config.ts

export const INVENTORY_LIST_CONFIG = {
    pageTitle: "Inventory List",
    pageDescription: "Manage your device inventory",
    breadcrumbs: [
        { label: "Home", url: "/" },
        { label: "Inventory", url: "/inventory" },
    ],
    displayedColumns: [
        "select",
        "hostname",
        "management_ip",
        "device_type",
        "device_group",
        "ha",
        "sw_version",
        "app_version",
        "details",
    ],
    retryCount: 3,
    retryDelay: 2000,
    refreshDialogWidth: "480px",
    deleteDialogWidth: "480px",
    syncDialogWidth: "520px",
    snackBarDuration: 3000,
};
