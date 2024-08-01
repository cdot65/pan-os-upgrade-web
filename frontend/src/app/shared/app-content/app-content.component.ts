// src/app/shared/app-content/app-content.component.ts

import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
    selector: "app-content",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./app-content.component.html",
    styleUrls: ["./app-content.component.scss"],
})
export class AppContentComponent {
    // Add any logic specific to the app-content component here
}
