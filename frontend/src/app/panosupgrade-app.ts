import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { map, pairwise, startWith } from "rxjs/operators";

import { NavBar } from "./shared/navbar/navbar";
import { NavigationFocusService } from "./shared/navigation-focus/navigation-focus.service";
import { RouterOutlet } from "@angular/router";
import { Subscription } from "rxjs";

@Component({
    selector: "panosupgrade-app",
    templateUrl: "./panosupgrade-app.html",
    styleUrls: ["./panosupgrade-app.scss"],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [NavBar, RouterOutlet],
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
                    if (!navigationFocusService.isNavigationWithinComponentView(fromUrl, toUrl)) {
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
