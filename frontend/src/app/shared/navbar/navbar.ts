import { Component, OnDestroy, OnInit } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import { Router, RouterLink, RouterLinkActive } from "@angular/router";

import { AuthService } from "../services/auth.service";
import { CookieService } from "ngx-cookie-service";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { NavigationFocusService } from "../navigation-focus/navigation-focus.service";
import { Subscription } from "rxjs";
import { ThemePicker } from "../theme-picker/theme-picker";

export interface DocSection {
    name: string;
    summary: string;
}

const INVENTORY = "inventory";
const UPGRADE = "upgrade";
const SETTINGS = "settings";

const SECTIONS: { [key: string]: DocSection } = {
    [INVENTORY]: {
        name: "Inventory",
        summary:
            "Manage your environments inventory of Palo Alto Networks firewalls and" +
            " Panorama appliances.",
    },
    [UPGRADE]: {
        name: "Upgrade",
        summary:
            "Manage your environments inventory of Palo Alto Networks firewalls and" +
            " Panorama appliances.",
    },
    [SETTINGS]: {
        name: "Settings",
        summary:
            "Manage your environments inventory of Palo Alto Networks firewalls and" +
            " Panorama appliances.",
    },
};
const SECTIONS_KEYS = Object.keys(SECTIONS);

@Component({
    selector: "app-navbar",
    templateUrl: "./navbar.html",
    styleUrls: ["./navbar.scss"],
    standalone: true,
    imports: [
        NgIf,
        MatButtonModule,
        MatIconModule,
        RouterLink,
        NgFor,
        RouterLinkActive,
        ThemePicker,
    ],
})
export class NavBar implements OnDestroy, OnInit {
    private subscriptions = new Subscription();
    skipLinkHref: string | null | undefined;
    skipLinkHidden = true;
    hasAuthToken = false;

    constructor(
        private navigationFocusService: NavigationFocusService,
        private cookieService: CookieService,
        private authService: AuthService,
        private router: Router,
    ) {
        setTimeout(
            () =>
                (this.skipLinkHref =
                    this.navigationFocusService.getSkipLinkHref()),
            100,
        );
    }

    ngOnInit() {
        this.authService.isLoggedIn$.subscribe((isLoggedIn: boolean) => {
            this.hasAuthToken = isLoggedIn;
        });
    }

    get sections() {
        return SECTIONS;
    }

    get sectionKeys() {
        return SECTIONS_KEYS;
    }

    logout() {
        this.cookieService.delete("auth_token");
        this.hasAuthToken = false;
        this.router.navigate(["/auth/login"]);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}
