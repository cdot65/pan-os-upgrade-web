/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/job-list/job-list.config.ts

export const JOB_LIST_CONFIG = {
    pageTitle: "Job List",
    pageDescription: "View and manage your jobs",
    breadcrumbs: [
        { label: "Home", url: "/" },
        { label: "Jobs", url: "/jobs" },
    ],
    displayedColumns: [
        "select",
        "task_id",
        "job_type",
        "created_at",
        "view_details",
    ],
    snackBarDuration: 3000,
    deleteDialogWidth: "300px",
};
