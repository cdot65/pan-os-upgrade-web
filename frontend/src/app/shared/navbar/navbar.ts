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

const INVENTORY = "inventory";
const PROFILES = "profiles";
const UPGRADE = "upgrade";
const JOBS = "jobs";
const HELP = "guides";

const SECTIONS: { [key: string]: DocSection } = {
    [INVENTORY]: {
        name: "Inventory",
        summary:
            "Manage your environments inventory of Palo Alto Networks firewalls and" +
            " Panorama appliances.",
    },
    [PROFILES]: {
        name: "Profiles",
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
    [JOBS]: {
        name: "Jobs",
        summary:
            "Manage your environments inventory of Palo Alto Networks firewalls and" +
            " Panorama appliances.",
    },
    [HELP]: {
        name: "Help",
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

    get sections() {
        return SECTIONS;
    }

    get sectionKeys() {
        return SECTIONS_KEYS;
    }
}
