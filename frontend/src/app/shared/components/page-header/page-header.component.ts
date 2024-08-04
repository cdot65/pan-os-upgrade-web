import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";

@Component({
    selector: "app-page-header",
    standalone: true,
    imports: [CommonModule, RouterModule, MatButtonModule],
    templateUrl: "./page-header.component.html",
    styleUrls: ["./page-header.component.scss"],
})
export class PageHeaderComponent {
    @Input() title: string = "";
    @Input() description: string = "";
    @Input() breadcrumbs: { label: string; url: string }[] = [];
}
