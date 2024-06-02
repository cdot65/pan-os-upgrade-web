// src/app/shared/sidenav/sidenav.ts

import {
    animate,
    state,
    style,
    transition,
    trigger,
} from "@angular/animations";

import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { MatDividerModule } from "@angular/material/divider";
import { MatExpansionModule } from "@angular/material/expansion";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { MatSidenavModule } from "@angular/material/sidenav";
import { RouterModule } from "@angular/router";
import { SidenavStateService } from "../services/sidenav-state.service";

@Component({
    selector: "app-sidenav",
    standalone: true,
    imports: [
        CommonModule,
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        MatExpansionModule,
        MatDividerModule,
        RouterModule,
    ],
    templateUrl: "./sidenav.html",
    styleUrls: ["./sidenav.scss"],
    animations: [
        trigger("sidenavAnimation", [
            state("expanded", style({ width: "275px" })),
            state("minimized", style({ width: "100px" })),
            transition("expanded <=> minimized", animate("300ms ease-in-out")),
        ]),
    ],
})
export class SideNav {
    get sidenavExpanded(): boolean {
        return this.sidenavStateService.isExpanded();
    }

    constructor(public sidenavStateService: SidenavStateService) {}

    toggleSidenav() {
        this.sidenavStateService.toggle();
    }
}
