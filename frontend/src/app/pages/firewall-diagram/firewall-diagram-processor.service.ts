// src/app/pages/firewall-diagram/firewall-diagram-processor.service.ts

import { Injectable } from "@angular/core";
import { Device, JobStatus } from "../../shared/interfaces/job.interface";
import { FirewallDiagramConfig } from "./firewall-diagram.config";

@Injectable({
    providedIn: "root",
})
export class FirewallDiagramProcessorService {
    getFirewallSrc(device: Device | undefined): string {
        if (
            FirewallDiagramConfig.haStates.passive.includes(
                device?.local_state as string,
            )
        ) {
            return FirewallDiagramConfig.imagePaths.firewallSecondary;
        }
        return FirewallDiagramConfig.imagePaths.firewallPrimary;
    }

    getStatusSvg(jobStatusDetails: JobStatus | null): string {
        switch (jobStatusDetails?.job_status) {
            case "completed":
                return FirewallDiagramConfig.imagePaths.statusCompleted;
            case "errored":
                return FirewallDiagramConfig.imagePaths.statusErrored;
            default:
                return FirewallDiagramConfig.imagePaths.statusInProgress;
        }
    }

    getStatusText(jobStatusDetails: JobStatus | null): string {
        return jobStatusDetails?.job_status === "completed"
            ? "Job completed"
            : (jobStatusDetails?.current_step ?? "");
    }

    getHaStatusClass(
        localState: string | undefined,
        haEnabled: boolean | undefined,
    ): string {
        if (!haEnabled) {
            return FirewallDiagramConfig.cssClasses.standalone;
        }
        if (
            FirewallDiagramConfig.haStates.active.includes(localState as string)
        ) {
            return FirewallDiagramConfig.cssClasses.haActive;
        }
        if (
            FirewallDiagramConfig.haStates.passive.includes((localState as string))
        ) {
            return FirewallDiagramConfig.cssClasses.haPassive;
        }
        return "";
    }
}
