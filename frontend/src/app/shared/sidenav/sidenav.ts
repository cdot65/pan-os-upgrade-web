// src/app/shared/sidenav/sidenav.ts

import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { MatSidenavModule } from "@angular/material/sidenav";
import { RouterModule } from "@angular/router";

@Component({
    selector: "app-sidenav",
    standalone: true,
    imports: [
        CommonModule,
        MatSidenavModule,
        MatListModule,
        MatIconModule,
        RouterModule,
    ],
    templateUrl: "./sidenav.html",
    styleUrls: ["./sidenav.scss"],
})
export class SideNav {}
