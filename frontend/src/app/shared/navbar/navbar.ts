import { NgFor, NgIf } from "@angular/common";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { AuthService } from "../services/auth.service";
import { Component } from "@angular/core";
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
export class NavBar {
    skipLinkHref: string | null | undefined;
    skipLinkHidden = true;

    constructor(
        public authService: AuthService,
        private navigationFocusService: NavigationFocusService,
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
}
