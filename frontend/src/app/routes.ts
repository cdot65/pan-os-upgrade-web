// eslint-disable-next-line max-len
import { CanActivateComponentSidenav } from "./pages/component-sidenav/component-sidenav-can-load-guard";
import { Routes } from "@angular/router";

export const PANOSUPGRADE_ROUTES: Routes = [
    {
        path: "",
        pathMatch: "full",
        loadComponent: () => import("./pages/homepage").then((m) => m.Homepage),
    },
    { path: "categories", redirectTo: "/components/categories" },
    { path: "cdk", pathMatch: "full", redirectTo: "/cdk/categories" },
    {
        path: "components",
        pathMatch: "full",
        redirectTo: "/components/categories",
    },
    {
        path: "guides",
        loadComponent: () =>
            import("./pages/guide-list").then((m) => m.GuideList),
    },
    { path: "guide/cdk-table", redirectTo: "/cdk/table/overview" },
    {
        path: "guide/:id",
        loadChildren: () =>
            import("./pages/guide-viewer").then((m) => m.GuideViewerModule),
    },
    {
        path: "404",
        loadComponent: () =>
            import("./pages/not-found").then((m) => m.NotFound),
    },
    {
        path: ":section",
        canActivate: [CanActivateComponentSidenav],
        loadChildren: () =>
            import("./pages/component-sidenav/component-sidenav").then(
                (m) => m.ComponentSidenavModule
            ),
    },
    { path: "**", redirectTo: "/404" },
];
