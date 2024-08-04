import { Component, HostBinding } from "@angular/core";

import { MatButtonModule } from "@angular/material/button";
import { RouterLink } from "@angular/router";

@Component({
    selector: "app-not-found",
    templateUrl: "./not-found.html",
    styleUrls: ["./not-found.scss"],
    standalone: true,
    imports: [MatButtonModule, RouterLink],
})
export class NotFound {
    @HostBinding("class.main-content") readonly mainContentClass = true;
}
