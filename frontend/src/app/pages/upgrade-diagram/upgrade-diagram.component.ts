import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
    selector: "app-upgrade-diagram",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./upgrade-diagram.component.html",
    styleUrls: ["./upgrade-diagram.component.scss"],
})
export class UpgradeDiagramComponent {
    @Input() currentStep: string | null = "";
    @Input() jobStatus: string | null = "";

    get statusSvg(): string {
        switch (this.jobStatus) {
            case "completed":
                return "assets/img/site/check.svg";
            case "errored":
                return "assets/img/site/failed.svg";
            default:
                return "assets/img/site/spin.svg";
        }
    }

    get statusText(): string {
        return this.jobStatus === "completed"
            ? "Job completed"
            : this.currentStep ?? "";
    }
}
