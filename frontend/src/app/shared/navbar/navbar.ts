// src/app/shared/navbar/navbar.ts

import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { AuthService } from "../services/auth.service";
import { NavigationFocusService } from "../navigation-focus/navigation-focus.service";
import { ThemePicker } from "../theme-picker";
import { SidenavStateService } from "../services/sidenav-state.service";

@Component({
    selector: "app-navbar",
    templateUrl: "./navbar.html",
    styleUrls: ["./navbar.scss"],
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatIconModule,
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
        public sidenavStateService: SidenavStateService,
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
        const storedTheme = this.themePicker.getStoredThemeName();
        if (storedTheme) {
            this.themePicker.selectTheme(storedTheme);
        } else {
            this.themePicker.selectTheme("redtail-light");
        }
    }
}
