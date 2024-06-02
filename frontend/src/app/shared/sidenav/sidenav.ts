// src/app/shared/sidenav/sidenav.ts

import { Component, OnInit } from "@angular/core";

import { CommonModule } from "@angular/common";
import { MatDividerModule } from "@angular/material/divider";
import { MatExpansionModule } from "@angular/material/expansion";
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
        MatExpansionModule,
        MatDividerModule,
        RouterModule,
    ],
    templateUrl: "./sidenav.html",
    styleUrls: ["./sidenav.scss"],
})
export class SideNav implements OnInit {
    sidenavExpanded: boolean = true;
    sidenavWidth: number = 275;

    ngOnInit() {
        const storedState = localStorage.getItem("sidenavExpanded");
        this.sidenavExpanded = storedState ? JSON.parse(storedState) : true;
        this.updateSidenavWidth();
    }

    toggleSidenav() {
        this.sidenavExpanded = !this.sidenavExpanded;
        localStorage.setItem(
            "sidenavExpanded",
            JSON.stringify(this.sidenavExpanded),
        );
        this.updateSidenavWidth();
    }

    updateSidenavWidth() {
        this.sidenavWidth = this.sidenavExpanded ? 275 : 100;
    }
}
