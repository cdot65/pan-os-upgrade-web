// upgrade-diagram.component.ts

import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Device, JobStatus } from "../../shared/interfaces/job.interface";

@Component({
    selector: "app-upgrade-diagram",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./upgrade-diagram.component.html",
    styleUrls: ["./upgrade-diagram.component.scss"],
})
export class UpgradeDiagramComponent {
    @Input() jobStatusDetails: JobStatus | null = null;

    getFirewallSrc(device: Device | undefined): string {
        if (
            device?.local_state === "passive" ||
            device?.local_state === "active-secondary"
        ) {
            return "assets/img/site/firewall_secondary.svg";
        }
        return "assets/img/site/firewall.svg";
    }

    get statusSvg(): string {
        switch (this.jobStatusDetails?.job_status) {
            case "completed":
                return "assets/img/site/check.svg";
            case "errored":
                return "assets/img/site/failed.svg";
            default:
                return "assets/img/site/spin.svg";
        }
    }

    get statusText(): string {
        return this.jobStatusDetails?.job_status === "completed"
            ? "Job completed"
            : (this.jobStatusDetails?.current_step ?? "");
    }
}
