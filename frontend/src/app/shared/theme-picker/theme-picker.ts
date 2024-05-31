import { ActivatedRoute, ParamMap } from "@angular/router";
import {
    ChangeDetectionStrategy,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from "@angular/core";
import { DocsSiteTheme, ThemeStorage } from "./theme-storage/theme-storage";
import { MatIconModule, MatIconRegistry } from "@angular/material/icon";

import { DomSanitizer } from "@angular/platform-browser";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";
import { NgFor } from "@angular/common";
import { StyleManager } from "../style-manager";
import { Subscription } from "rxjs";
import { map } from "rxjs/operators";

@Component({
    selector: "theme-picker",
    templateUrl: "theme-picker.html",
    styleUrls: ["theme-picker.scss"],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        MatButtonModule,
        MatTooltipModule,
        MatMenuModule,
        MatIconModule,
        NgFor,
    ],
})
export class ThemePicker implements OnInit, OnDestroy {
    private _queryParamSubscription = Subscription.EMPTY;
    currentTheme: DocsSiteTheme | undefined;

    // The below colors need to align with the themes defined in theme-picker.scss
    themes: DocsSiteTheme[] = [
        {
            primary: "#395873",
            accent: "#d96704",
            displayName: "Redtail",
            name: "redtail",
            isDark: false,
            isDefault: true,
        },
        {
            primary: "#673AB7",
            accent: "#FFC107",
            displayName: "Deep Purple & Amber",
            name: "deeppurple-amber",
            isDark: false,
        },
        {
            primary: "#9C27B0",
            accent: "#4CAF50",
            displayName: "Purple & Green",
            name: "purple-green",
            isDark: true,
        },
    ];

    constructor(
        public styleManager: StyleManager,
        private _themeStorage: ThemeStorage,
        private _activatedRoute: ActivatedRoute,
        private liveAnnouncer: LiveAnnouncer,
        iconRegistry: MatIconRegistry,
        sanitizer: DomSanitizer,
    ) {
        iconRegistry.addSvgIcon(
            "theme-example",
            sanitizer.bypassSecurityTrustResourceUrl(
                "assets/img/theme-demo-icon.svg",
            ),
        );
        const themeName = this._themeStorage.getStoredThemeName();
        if (themeName) {
            this.selectTheme(themeName);
        } else {
            this.themes.find((themes) => {
                if (themes.isDefault === true) {
                    this.selectTheme(themes.name);
                }
            });
        }
    }

    ngOnInit() {
        this._queryParamSubscription = this._activatedRoute.queryParamMap
            .pipe(map((params: ParamMap) => params.get("theme")))
            .subscribe((themeName: string | null) => {
                if (themeName) {
                    this.selectTheme(themeName);
                }
            });
    }

    ngOnDestroy() {
        this._queryParamSubscription.unsubscribe();
    }

    selectTheme(themeName: string) {
        const theme = this.themes.find(
            (currentTheme) => currentTheme.name === themeName,
        );
        if (!theme) {
            return;
        }

        this.currentTheme = theme;

        // Always set the style, even for the default theme
        this.styleManager.setStyle("theme", `${theme.name}.css`);

        if (this.currentTheme) {
            this.liveAnnouncer.announce(
                `${theme.displayName} theme selected.`,
                "polite",
                3000,
            );
            this._themeStorage.storeTheme(this.currentTheme);
        }
    }
}
