// src/app/app.ts

import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";

import { AuthInterceptor } from "./shared/interceptors/auth.interceptor";
import { CookieService } from "ngx-cookie-service";
import { HTTP_INTERCEPTORS } from "@angular/common/http";
import { NavBar } from "./shared/components/navbar";
import { RouterOutlet } from "@angular/router";
import { Subscription } from "rxjs";
import { ThemePicker } from "./shared/components/theme-picker";

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

    constructor() {}

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}
