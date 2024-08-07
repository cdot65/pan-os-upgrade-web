// src/app/shared/layout/layout.ts

import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet } from "@angular/router";
import { NavBar } from "../navbar";
import { SideNav } from "../sidenav/sidenav";
import { SidenavStateService } from "../../services/sidenav-state.service";

@Component({
    selector: "app-layout",
    standalone: true,
    imports: [CommonModule, SideNav, RouterOutlet, NavBar],
    templateUrl: "./layout.html",
    styleUrls: ["./layout.scss"],
})
export class Layout {
    constructor(public sidenavStateService: SidenavStateService) {}
}
