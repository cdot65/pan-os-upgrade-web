// src/app/shared/app-content/app-content.component.ts

import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SidenavStateService } from "../services/sidenav-state.service";

@Component({
    selector: "app-content",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./app-content.component.html",
    styleUrls: ["./app-content.component.scss"],
})
export class AppContentComponent {
    constructor(public sidenavStateService: SidenavStateService) {}
}
