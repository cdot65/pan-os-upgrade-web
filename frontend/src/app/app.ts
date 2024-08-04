// src/app/app.ts

import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { map, pairwise, startWith } from "rxjs/operators";

import { AuthInterceptor } from "./shared/interceptors/auth.interceptor";
import { CookieService } from "ngx-cookie-service";
import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { NavBar } from "./shared/navbar";
import { NavigationFocusService } from "./shared/navigation-focus/navigation-focus.service";
import { RouterOutlet } from "@angular/router";
import { Subscription } from "rxjs";
import { ThemePicker } from "./shared/theme-picker";

@Component({
    selector: "app",
    templateUrl: "./app.html",
    styleUrls: ["./app.scss"],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [NavBar, RouterOutlet, ThemePicker],
    providers: [
        CookieService,
        { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    ],
})
export class PanOsUpgradeApp implements OnDestroy {
    private subscriptions = new Subscription();

    constructor(navigationFocusService: NavigationFocusService) {
        this.subscriptions.add(
            navigationFocusService.navigationEndEvents
                .pipe(
                    map((e) => e.urlAfterRedirects),
                    startWith(""),
                    pairwise(),
                )
                .subscribe(([fromUrl, toUrl]) => {
                    if (
                        !navigationFocusService.isNavigationWithinComponentView(
                            fromUrl,
                            toUrl,
                        )
                    ) {
                        resetScrollPosition();
                    }
                }),
        );
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}

function resetScrollPosition() {
    if (typeof document === "object" && document) {
        const sidenavContent = document.querySelector(".mat-drawer-content");
        if (sidenavContent) {
            sidenavContent.scrollTop = 0;
        }
    }
}
