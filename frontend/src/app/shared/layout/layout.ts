// src/app/shared/layout/layout.ts

import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterOutlet } from "@angular/router";
import { SideNav } from "../sidenav/sidenav";
import { Footer } from "../footer/footer";
import { AppContentComponent } from "../app-content/app-content.component";
import { NavBar } from "../navbar";

@Component({
    selector: "app-layout",
    standalone: true,
    imports: [
        CommonModule,
        SideNav,
        Footer,
        RouterOutlet,
        AppContentComponent,
        NavBar,
    ],
    templateUrl: "./layout.html",
    styleUrls: ["./layout.scss"],
})
export class Layout {}
