import { NgFor, NgIf } from "@angular/common";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { AuthService } from "../services/auth.service";
import { Component, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { NavigationFocusService } from "../navigation-focus/navigation-focus.service";
import { ThemePicker } from "../theme-picker/theme-picker";

export interface DocSection {
    name: string;
    summary: string;
}

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
export class NavBar implements OnInit {
    skipLinkHref: string | null | undefined;
    skipLinkHidden = true;

    constructor(
        public authService: AuthService,
        private navigationFocusService: NavigationFocusService,
        private themePicker: ThemePicker,
    ) {
        setTimeout(
            () =>
                (this.skipLinkHref =
                    this.navigationFocusService.getSkipLinkHref()),
            100,
        );
    }

    get hasAuthToken() {
        return this.authService.getIsLoggedIn();
    }

    ngOnInit() {
        // Initialize the theme
        const storedTheme = this.themePicker.getStoredThemeName();
        if (storedTheme) {
            this.themePicker.selectTheme(storedTheme);
        } else {
            // Select default theme
            this.themePicker.selectTheme("redtail-light");
        }
    }
}
