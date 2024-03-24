// src/app/pages/guide-list/guide-list.ts;

import { Component, HostBinding, OnInit } from "@angular/core";

import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "../../shared/footer/footer";
import { GuideItems } from "../../shared/guide-items/guide-items";
import { MatCardModule } from "@angular/material/card";
import { NavigationFocus } from "../../shared/navigation-focus/navigation-focus";
import { NgFor } from "@angular/common";
import { RouterLink } from "@angular/router";

@Component({
    selector: "app-guides",
    templateUrl: "./guide-list.html",
    styleUrls: ["./guide-list.scss"],
    standalone: true,
    imports: [NavigationFocus, NgFor, RouterLink, MatCardModule, Footer],
})
export class GuideList implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    constructor(
        public guideItems: GuideItems,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    ngOnInit(): void {
        this._componentPageTitle.title = "Guides";
    }
}
