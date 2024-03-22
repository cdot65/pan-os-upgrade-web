import { Injectable } from "@angular/core";
import { Title } from "@angular/platform-browser";

/**
 * Service responsible for setting the title that appears above the components and guide pages.
 */
@Injectable({ providedIn: "root" })
export class ComponentPageTitle {
    _title = "";
    _originalTitle = "PAN-OS Upgrade";

    get title(): string {
        return this._title;
    }

    set title(title: string) {
        this._title = title;
        if (title !== "") {
            title = `${title} | PAN-OS Upgrade`;
        } else {
            title = this._originalTitle;
        }
        this.bodyTitle.setTitle(title);
    }

    constructor(private bodyTitle: Title) {}
}
