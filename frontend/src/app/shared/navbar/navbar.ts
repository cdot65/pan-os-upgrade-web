import { Component, OnDestroy } from "@angular/core";
import { NgFor, NgIf } from "@angular/common";
import { RouterLink, RouterLinkActive } from "@angular/router";

import { MatButtonModule } from "@angular/material/button";
import { NavigationFocusService } from "../navigation-focus/navigation-focus.service";
import { SECTIONS } from "../documentation-items/documentation-items";
import { Subscription } from "rxjs";
import { ThemePicker } from "../theme-picker/theme-picker";
import { VersionPicker } from "../version-picker/version-picker";

const SECTIONS_KEYS = Object.keys(SECTIONS);

@Component({
    selector: "app-navbar",
    templateUrl: "./navbar.html",
    styleUrls: ["./navbar.scss"],
    standalone: true,
    imports: [
        NgIf,
        MatButtonModule,
        RouterLink,
        NgFor,
        RouterLinkActive,
        VersionPicker,
        ThemePicker,
    ],
})
export class NavBar implements OnDestroy {
    private subscriptions = new Subscription();
    skipLinkHref: string | null | undefined;
    skipLinkHidden = true;

    constructor(private navigationFocusService: NavigationFocusService) {
        setTimeout(
            () =>
                (this.skipLinkHref =
                    this.navigationFocusService.getSkipLinkHref()),
            100
        );
    }

    get sections() {
        return SECTIONS;
    }

    get sectionKeys() {
        return SECTIONS_KEYS;
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}
