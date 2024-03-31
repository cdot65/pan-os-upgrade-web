// src/app/routes.ts

// eslint-disable-next-line max-len
import { Routes } from "@angular/router";
import { authGuard } from "./shared/guards/auth.guard";

export const PANOSUPGRADE_ROUTES: Routes = [
    {
        path: "",
        pathMatch: "full",
        loadComponent: () => import("./pages/homepage").then((m) => m.Homepage),
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
        path: "guide/cdk-table",
        redirectTo: "/cdk/table/overview",
    },
    {
        path: "inventory",
        loadComponent: () =>
            import("./pages/inventory-list").then((m) => m.InventoryList),
        canActivate: [authGuard],
    },
    {
        path: "inventory/create",
        loadComponent: () =>
            import("./pages/inventory-create").then(
                (m) => m.InventoryCreateComponent,
            ),
        canActivate: [authGuard],
    },
    {
        path: "inventory/:id",
        loadComponent: () =>
            import("./pages/inventory-details").then(
                (m) => m.InventoryDetailsComponent,
            ),
        canActivate: [authGuard],
    },
    {
        path: "settings",
        pathMatch: "full",
        redirectTo: "/settings/profiles",
    },
    {
        path: "settings/profiles",
        loadComponent: () =>
            import("./pages/settings-profile-list").then(
                (m) => m.SettingsProfileListComponent,
            ),
        canActivate: [authGuard],
    },
    {
        path: "settings/profiles/:id",
        loadComponent: () =>
            import("./pages/settings-profile-details").then(
                (m) => m.SettingsProfileDetailsComponent,
            ),
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
