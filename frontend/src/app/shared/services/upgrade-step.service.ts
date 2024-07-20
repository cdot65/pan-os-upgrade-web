// src/app/shared/services/upgrade-step.service.ts
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface StepMapping {
    name: string;
    svgPath: string;
}

@Injectable({
    providedIn: "root",
})
export class UpgradeStepService {
    private readonly stepMappings: StepMapping[] = [
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

    private currentStepSubject = new BehaviorSubject<string>("");
    currentStep$ = this.currentStepSubject.asObservable();

    updateCurrentStep(logs: any[]): void {
        const reversedLogs = [...logs].reverse();
        for (const log of reversedLogs) {
            const message = log.message;
            if (message.includes("Upgrade required from")) {
                this.currentStepSubject.next("Validate Upgrade Path");
                break;
            } else if (
                message.includes("Checking to see if the target image")
            ) {
                this.currentStepSubject.next("Image Version Validation");
                break;
            } else if (message.includes("Begin running the readiness checks")) {
                this.currentStepSubject.next("Readiness Checks");
                break;
            } else if (
                message.includes(
                    "Performing snapshot of network state information pre-upgrade",
                )
            ) {
                this.currentStepSubject.next("Pre-Upgrade Snapshot");
                break;
            } else if (message.includes("Suspending the HA state of device")) {
                this.currentStepSubject.next("HA State Suspension");
                break;
            }
            // Add more conditions as needed
        }
    }

    getCurrentStepSvgPath(): Observable<string> {
        return this.currentStep$.pipe(
            map((step) => {
                const currentStepMapping = this.stepMappings.find(
                    (mapping) => mapping.name === step,
                );
                return currentStepMapping ? currentStepMapping.svgPath : "";
            }),
        );
    }
}
