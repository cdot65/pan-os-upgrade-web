// src/app/shared/sidenav/sidenav.ts

import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatListModule } from "@angular/material/list";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { RouterModule } from "@angular/router";
import { SidenavStateService } from "../../services/sidenav-state.service";
import {
    animate,
    state,
    style,
    transition,
    trigger,
} from "@angular/animations";
import { MatAnchor } from "@angular/material/button";

@Component({
    selector: "app-sidenav",
    standalone: true,
    imports: [
        CommonModule,
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        MatDividerModule,
        RouterModule,
        MatAnchor,
    ],
    templateUrl: "./sidenav.html",
    styleUrls: ["./sidenav.scss"],
    animations: [
        trigger("sidenavAnimation", [
            state("expanded", style({ width: "250px" })),
            state("minimized", style({ width: "64px" })),
            transition("expanded <=> minimized", animate("300ms ease-in-out")),
        ]),
    ],
})
export class SideNav {
    constructor(public sidenavStateService: SidenavStateService) {}

    toggleSidenav() {
        this.sidenavStateService.toggle();
    }
}
