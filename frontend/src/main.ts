// src/main.ts

import { LocationStrategy, PathLocationStrategy } from "@angular/common";
import {
    provideAnimations,
    provideNoopAnimations,
} from "@angular/platform-browser/animations";
import { provideRouter, withInMemoryScrolling } from "@angular/router";

import { APP_ROUTES } from "./app/routes";
import { PanOsUpgradeApp } from "./app";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideHttpClient } from "@angular/common/http";
import { unregisterServiceWorkers } from "./unregister-service-workers";
import { StyleManager } from "./app/shared/components/style-manager";
import { ThemePicker } from "./app/shared/components/theme-picker";

const prefersReducedMotion =
    typeof matchMedia === "function"
        ? matchMedia("(prefers-reduced-motion)").matches
        : false;

// Unregister all installed service workers and force reload the page if there was
// an old service worker from a previous version of the docs.
unregisterServiceWorkers().then(
    (hadServiceWorker) => hadServiceWorker && location.reload(),
);

bootstrapApplication(PanOsUpgradeApp, {
    providers: [
        StyleManager,
        ThemePicker,
        prefersReducedMotion ? provideNoopAnimations() : provideAnimations(),
        { provide: LocationStrategy, useClass: PathLocationStrategy },
        provideRouter(
            APP_ROUTES,
            withInMemoryScrolling({
                scrollPositionRestoration: "enabled",
                anchorScrolling: "enabled",
            }),
        ),
        provideHttpClient(),
    ],
}).catch((err) => console.error(err));
