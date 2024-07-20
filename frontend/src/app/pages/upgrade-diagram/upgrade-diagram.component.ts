// src/app/pages/upgrade-diagram/upgrade-diagram.component.ts
import { Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common";

interface StepMapping {
    name: string;
    svgPath: string;
}

@Component({
    selector: "app-upgrade-diagram",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./upgrade-diagram.component.html",
    styleUrls: ["./upgrade-diagram.component.scss"],
})
export class UpgradeDiagramComponent implements OnChanges {
    @Input() currentStep: string = "";

    readonly stepMappings: StepMapping[] = [
        {
            name: "Validate Upgrade Path",
            svgPath: "assets/img/site/validate-upgrade-path.svg",
        },
        {
            name: "s",
            svgPath: "assets/img/site/image-version-validation.svg",
        },
        {
            name: "Download Base Image",
            svgPath: "assets/img/site/download-base-image.svg",
        },
        {
            name: "Download Target Image",
            svgPath: "assets/img/site/download-target-image.svg",
        },
        {
            name: "Readiness Checks",
            svgPath: "assets/img/site/readiness-checks.svg",
        },
        {
            name: "Pre-Upgrade Snapshot",
            svgPath: "assets/img/site/pre-upgrade-snapshot.svg",
        },
        {
            name: "HA State Suspension",
            svgPath: "assets/img/site/ha-state-suspension.svg",
        },
        {
            name: "Upgrade PAN-OS",
            svgPath: "assets/img/site/upgrade-pan-os.svg",
        },
        {
            name: "Reboot and Wait",
            svgPath: "assets/img/site/reboot-and-wait.svg",
        },
        {
            name: "Post-Upgrade Snapshot",
            svgPath: "assets/img/site/post-upgrade-snapshot.svg",
        },
        {
            name: "Upgrade Complete",
            svgPath: "assets/img/site/upgrade-complete.svg",
        },
    ];

    ngOnChanges(changes: SimpleChanges): void {
        if (changes["currentStep"]) {
            this.getCurrentStepSvgPath();
        }
    }

    getCurrentStepSvgPath(): string {
        const currentStepMapping = this.stepMappings.find(
            (step) => step.name === this.currentStep,
        );
        return currentStepMapping ? currentStepMapping.svgPath : "";
    }
}
