/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-details/profile-details.config.ts

export const PROFILE_DETAILS_CONFIG = {
    pageTitle: "Profile Details",
    pageDescription: "View and edit settings profile details",
    breadcrumbs: [
        { label: "Home", url: "/" },
        { label: "Profiles", url: "/profiles" },
        { label: "Details", url: "" },
    ],
    snackBarDuration: 3000,
    errorMessages: {
        fetchFailed: "Failed to fetch profile. Please try again.",
        updateFailed: "Failed to update profile. Please try again.",
    },
};
