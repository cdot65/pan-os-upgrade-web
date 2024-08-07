/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-create/profile-create.config.ts

export const PROFILE_CREATE_CONFIG = {
    pageTitle: "Create Settings Profile",
    pageDescription: "Create a new settings profile for your devices",
    breadcrumbs: [
        { label: "Home", url: "/" },
        { label: "Profiles", url: "/profiles" },
        { label: "Create", url: "/profiles/create" },
    ],
    snackBarDuration: 3000,
    formDefaults: {
        max_download_tries: 3,
        download_retry_interval: 30,
        max_install_attempts: 3,
        install_retry_interval: 60,
        max_reboot_tries: 30,
        reboot_retry_interval: 60,
        max_snapshot_tries: 3,
        snapshot_retry_interval: 60,
        command_timeout: 120,
        connection_timeout: 30,
    },
};
