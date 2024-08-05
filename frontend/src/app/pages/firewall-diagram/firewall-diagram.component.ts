// src/app/pages/firewall-diagram/firewall-diagram.component.ts

import { Component, Input } from "@angular/core";
import { CommonModule, NgOptimizedImage } from "@angular/common";
import { MatChipsModule } from "@angular/material/chips";
import { JobStatus } from "../../shared/interfaces/job.interface";
import { FirewallDiagramFacade } from "./firewall-diagram.facade";

@Component({
    selector: "app-firewall-diagram",
    standalone: true,
    imports: [CommonModule, MatChipsModule, NgOptimizedImage],
    providers: [FirewallDiagramFacade],
    templateUrl: "./firewall-diagram.component.html",
    styleUrls: ["./firewall-diagram.component.scss"],
})
export class FirewallDiagramComponent {
    @Input() set jobStatusDetails(value: JobStatus | null) {
        this.facade.setJobStatusDetails(value);
    }

    constructor(public facade: FirewallDiagramFacade) {}
}
