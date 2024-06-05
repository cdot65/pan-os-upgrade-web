// src/app/shared/layout/layout.ts

import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Footer } from "../footer/footer";
import { RouterOutlet } from "@angular/router";
import { SideNav } from "../sidenav/sidenav";

@Component({
    selector: "app-layout",
    standalone: true,
    imports: [CommonModule, SideNav, Footer, RouterOutlet],
    template: `
        <div class="app-layout">
            <app-sidenav></app-sidenav>
            <div class="app-content">
                <ng-content></ng-content>
            </div>
            <app-footer></app-footer>
        </div>
    `,
    styleUrls: ["./layout.scss"],
})
export class Layout {}
