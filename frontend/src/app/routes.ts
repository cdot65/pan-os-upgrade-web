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
        path: "inventory/sync",
        loadComponent: () =>
            import("./pages/inventory-sync").then(
                (m) => m.InventorySyncComponent,
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
        path: "profiles",
        loadComponent: () =>
            import("./pages/profile-list").then((m) => m.ProfileListComponent),
        canActivate: [authGuard],
    },
    {
        path: "profiles/create",
        loadComponent: () =>
            import("./pages/profile-create").then(
                (m) => m.ProfileCreateComponent,
            ),
        canActivate: [authGuard],
    },
    {
        path: "profiles/:uuid",
        loadComponent: () =>
            import("./pages/profile-details").then(
                (m) => m.ProfileDetailsComponent,
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
