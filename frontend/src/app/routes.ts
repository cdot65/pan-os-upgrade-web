// src/app/routes.ts

import { Layout } from "./shared/layout/layout";
import { Routes } from "@angular/router";
import { authGuard } from "./shared/guards/auth.guard";
import { LoginComponent } from "./pages/auth/login/login.component";

export const APP_ROUTES: Routes = [
    {
        path: "",
        component: Layout,
        canActivate: [authGuard],
        children: [
            {
                path: "",
                loadComponent: () =>
                    import("./pages/homepage").then((m) => m.HomepageComponent),
            },
            {
                path: "inventory",
                canActivate: [authGuard],
                children: [
                    {
                        path: "",
                        loadComponent: () =>
                            import("./pages/inventory-list").then(
                                (m) => m.InventoryListComponent,
                            ),
                    },
                    {
                        path: "create",
                        loadComponent: () =>
                            import("./pages/inventory-create").then(
                                (m) => m.InventoryCreateComponent,
                            ),
                    },
                    {
                        path: ":id",
                        loadComponent: () =>
                            import("./pages/inventory-details").then(
                                (m) => m.InventoryDetailsComponent,
                            ),
                    },
                ],
            },
            {
                path: "jobs",
                canActivate: [authGuard],
                children: [
                    {
                        path: "",
                        loadComponent: () =>
                            import("./pages/job-list").then(
                                (m) => m.JobListComponent,
                            ),
                    },
                    {
                        path: ":id",
                        loadComponent: () =>
                            import("./pages/job-details").then(
                                (m) => m.JobDetailsComponent,
                            ),
                    },
                ],
            },
            {
                path: "profiles",
                canActivate: [authGuard],
                children: [
                    {
                        path: "",
                        loadComponent: () =>
                            import("./pages/profile-list").then(
                                (m) => m.ProfileListComponent,
                            ),
                    },
                    {
                        path: "create",
                        loadComponent: () =>
                            import("./pages/profile-create").then(
                                (m) => m.ProfileCreateComponent,
                            ),
                    },
                    {
                        path: ":uuid",
                        loadComponent: () =>
                            import("./pages/profile-details").then(
                                (m) => m.ProfileDetailsComponent,
                            ),
                    },
                ],
            },
            {
                path: "snapshots",
                canActivate: [authGuard],
                children: [
                    {
                        path: "",
                        loadComponent: () =>
                            import("./pages/snapshot-list").then(
                                (m) => m.SnapshotListComponent,
                            ),
                    },
                ],
            },
            {
                path: "upgrade",
                canActivate: [authGuard],
                children: [
                    {
                        path: "",
                        loadComponent: () =>
                            import("./pages/upgrade-list").then(
                                (m) => m.UpgradeListComponent,
                            ),
                    },
                    {
                        path: ":uuid",
                        loadComponent: () =>
                            import("./pages/upgrade-list").then(
                                (m) => m.UpgradeListComponent,
                            ),
                    },
                ],
            },
        ],
    },
    {
        path: "auth",
        children: [
            {
                path: "login",
                component: LoginComponent,
            },
            // {
            //     path: "register",
            //     component: RegisterComponent,
            // },
        ],
    },
    {
        path: "404",
        loadComponent: () =>
            import("./pages/not-found").then((m) => m.NotFound),
    },
    {
        path: "**",
        redirectTo: "/404",
    },
];
