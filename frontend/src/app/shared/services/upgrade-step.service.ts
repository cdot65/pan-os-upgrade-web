import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { Job } from "../interfaces/job.interface";

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

    updateCurrentStep(job: Job): void {
        this.currentStepSubject.next(job.current_step);
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
