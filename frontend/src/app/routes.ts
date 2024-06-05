// src/app/routes.ts

import { Layout } from "./shared/layout/layout";
import { Routes } from "@angular/router";
import { authGuard } from "./shared/guards/auth.guard";

export const APP_ROUTES: Routes = [
    {
        path: "",
        component: Layout,
        canActivate: [authGuard],
        children: [
            {
                path: "",
                loadComponent: () =>
                    import("./pages/homepage").then((m) => m.Homepage),
            },
            {
                path: "inventory",
                canActivate: [authGuard],
                children: [
                    {
                        path: "",
                        loadComponent: () =>
                            import("./pages/inventory-list").then(
                                (m) => m.InventoryList,
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
        loadChildren: () =>
            import("./pages/auth/auth.module").then((m) => m.AuthModule),
    },
    {
        path: "guides",
        loadComponent: () =>
            import("./pages/guide-list").then((m) => m.GuideList),
        canActivate: [authGuard],
    },
    {
        path: "guide/:id",
        loadChildren: () =>
            import("./pages/guide-viewer").then((m) => m.GuideViewerModule),
        canActivate: [authGuard],
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
