import { Component, EventEmitter, Output } from "@angular/core";

import { ComponentPageTitle } from "../page-title/page-title";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";

@Component({
    selector: "inventory-page-header",
    templateUrl: "./inventory-page-header.html",
    styleUrls: ["./inventory-page-header.scss"],
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
})
export class InventoryPageHeader {
    constructor(public _componentPageTitle: ComponentPageTitle) {}

    @Output() toggleSidenav = new EventEmitter<void>();

    getTitle() {
        return this._componentPageTitle.title;
    }
}
