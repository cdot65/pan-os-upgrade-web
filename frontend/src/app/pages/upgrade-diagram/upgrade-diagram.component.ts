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
    @Input() completedSteps: string[] = [];

    currentStep: string = "";

    readonly stepMappings: StepMapping[] = [
        {
            name: "Validate Upgrade Path",
            svgPath: "assets/img/site/validate-upgrade-path.svg",
        },
        {
            name: "Image Version Validation",
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
        if (changes["completedSteps"]) {
            this.updateCurrentStep();
        }
    }

    getCurrentStepSvgPath(): string {
        const currentStepMapping = this.stepMappings.find(
            (step) => step.name === this.currentStep,
        );
        return currentStepMapping ? currentStepMapping.svgPath : "";
    }

    private updateCurrentStep(): void {
        for (const step of this.stepMappings) {
            if (!this.isStepComplete(step.name)) {
                this.currentStep = step.name;
                return;
            }
        }
        this.currentStep = "Upgrade Complete";
    }

    private isStepComplete(step: string): boolean {
        switch (step) {
            case "Validate Upgrade Path":
                return this.completedSteps.some((s) =>
                    s.includes("The target version is compatible"),
                );
            case "Image Version Validation":
                return this.completedSteps.some((s) =>
                    s.includes("found in list of available versions"),
                );
            case "Download Base Image":
                return this.completedSteps.some(
                    (s) =>
                        s.includes("Base image") &&
                        s.includes("skipping the download process"),
                );
            case "Download Target Image":
                return this.completedSteps.some(
                    (s) =>
                        s.includes("Target image") &&
                        s.includes("skipping the process of downloading again"),
                );
            case "Readiness Checks":
                return this.completedSteps.some((s) =>
                    s.includes("Readiness checks successfully completed"),
                );
            case "Pre-Upgrade Snapshot":
                return this.completedSteps.some(
                    (s) =>
                        s.includes(
                            "Snapshot creation completed successfully",
                        ) && s.includes("pre-upgrade"),
                );
            case "HA State Suspension":
                return this.completedSteps.some((s) =>
                    s.includes("HA state suspended"),
                );
            case "Upgrade PAN-OS":
                return this.completedSteps.some((s) =>
                    s.includes("Upgrade completed successfully"),
                );
            case "Reboot and Wait":
                return this.completedSteps.some(
                    (s) =>
                        s.includes("Device upgraded") &&
                        s.includes("rebooted successfully"),
                );
            case "Post-Upgrade Snapshot":
                return this.completedSteps.some(
                    (s) =>
                        s.includes(
                            "Snapshot creation completed successfully",
                        ) && s.includes("post-upgrade"),
                );
            default:
                return false;
        }
    }
}
