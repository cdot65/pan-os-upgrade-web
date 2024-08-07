/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/job-details/job-details.config.ts

export const JOB_DETAILS_CONFIG = {
    pageTitle: "Job Details",
    pageDescription: "View details and logs for the selected job",
    breadcrumbs: [
        { label: "Home", url: "/" },
        { label: "Jobs", url: "/jobs" },
        { label: "Details", url: "" },
    ],
    pollingInterval: 3000, // 3 seconds
    snackBarDuration: 3000,
};
