/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-list/profile-list.config.ts

export const PROFILE_LIST_CONFIG = {
    pageTitle: "Profile List",
    pageDescription: "Manage your settings profiles",
    breadcrumbs: [
        { label: "Home", url: "/" },
        { label: "Profiles", url: "/profiles" },
    ],
    displayedColumns: ["select", "name", "description", "details"],
    deleteDialogWidth: "300px",
    snackBarDuration: 3000,
    errorMessages: {
        fetchFailed: "Failed to fetch settings profiles. Please try again.",
        deleteFailed: "Failed to delete profile. Please try again.",
        deleteSelectedFailed:
            "Failed to delete selected profiles. Please try again.",
    },
};
