// src/app/pages/firewall-diagram/firewall-diagram.facade.ts

import { computed, Injectable, signal } from "@angular/core";
import { Device, JobStatus } from "../../shared/interfaces/job.interface";
import { FirewallDiagramProcessorService } from "./firewall-diagram-processor.service";

@Injectable()
export class FirewallDiagramFacade {
    public jobStatusDetails = signal<JobStatus | null>(null);

    statusSvg = computed(() =>
        this.processor.getStatusSvg(this.jobStatusDetails()),
    );
    statusText = computed(() =>
        this.processor.getStatusText(this.jobStatusDetails()),
    );
    hasPeerDevice = computed(() => !!this.jobStatusDetails()?.devices?.peer);

    constructor(private processor: FirewallDiagramProcessorService) {}

    setJobStatusDetails(details: JobStatus | null) {
        this.jobStatusDetails.set(details);
    }

    getFirewallSrc(device: Device | undefined): string {
        return this.processor.getFirewallSrc(device);
    }

    getHaStatusClass(
        localState: string | undefined,
        haEnabled: boolean | undefined,
    ): string {
        return this.processor.getHaStatusClass(localState, haEnabled);
    }
}
