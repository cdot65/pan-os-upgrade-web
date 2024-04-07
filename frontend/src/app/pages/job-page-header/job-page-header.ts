import { Component, EventEmitter, Output } from "@angular/core";

import { ComponentPageTitle } from "../page-title/page-title";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

@Component({
    selector: "app-job-page-header",
    templateUrl: "./job-page-header.html",
    styleUrls: ["./job-page-header.scss"],
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
})
export class JobPageHeader {
    constructor(public _componentPageTitle: ComponentPageTitle) {}

    @Output() toggleSidenav = new EventEmitter<void>();

    getTitle() {
        return this._componentPageTitle.title;
    }
}
