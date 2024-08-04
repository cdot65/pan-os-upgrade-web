// src/app/pages/documentation/documentation.ts

import {
    Component,
    HostBinding,
    Inject,
    OnInit,
    Optional,
} from "@angular/core";
import { ANIMATION_MODULE_TYPE } from "@angular/platform-browser/animations";

import { MatButtonModule } from "@angular/material/button";
import { RouterLink } from "@angular/router";
import { ComponentPageTitle } from "../page-title/page-title";
import { NavigationFocus } from "../../shared/navigation-focus/navigation-focus";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatCardModule } from "@angular/material/card";
import { GuideItems } from "../../shared/guide-items/guide-items";
import { NgFor } from "@angular/common";
import { YouTubePlayer } from "@angular/youtube-player";

import { Carousel, CarouselItem } from "../../shared/carousel/carousel";

@Component({
    selector: "app-documentation",
    templateUrl: "./documentation.html",
    styleUrls: ["./documentation.scss"],
    standalone: true,
    imports: [
        NavigationFocus,
        MatButtonModule,
        RouterLink,
        MatDividerModule,
        MatIconModule,
        Carousel,
        NgFor,
        CarouselItem,
        MatCardModule,
        YouTubePlayer,
    ],
})
export class Documentation implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    @HostBinding("class.animations-disabled")
    readonly animationsDisabled: boolean;

    constructor(
        public _componentPageTitle: ComponentPageTitle,
        public guideItems: GuideItems,
        @Optional() @Inject(ANIMATION_MODULE_TYPE) animationsModule?: string,
    ) {
        this.animationsDisabled = animationsModule === "NoopAnimations";
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Documentation";
    }
}
