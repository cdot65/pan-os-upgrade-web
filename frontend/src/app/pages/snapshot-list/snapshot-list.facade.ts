// src/app/snapshots/snapshot-list/snapshot-list.facade.ts

import { computed, Injectable, signal } from "@angular/core";
import { SnapshotService } from "../../shared/services/snapshot.service";
import { SnapshotProcessorService } from "./snapshot-processor.service";
import {
    SessionStats,
    Snapshot,
} from "../../shared/interfaces/snapshot.interface";

@Injectable()
export class SnapshotListFacade {
    private snapshots = signal<Snapshot[]>([]);
    private selectedJobId = signal<string | null>(null);
    private selectedDeviceHostname = signal<string | null>(null);
    private selectedSnapshotType = signal<"pre" | "post">("pre");

    jobIds = computed(() => [...new Set(this.snapshots().map((s) => s.job))]);
    deviceHostnames = computed(() => {
        const jobId = this.selectedJobId();
        return [
            ...new Set(
                this.snapshots()
                    .filter((s) => !jobId || s.job === jobId)
                    .map((s) => s.device_hostname),
            ),
        ];
    });

    filteredSnapshots = computed(() =>
        this.snapshots()
            .filter(
                (snapshot) =>
                    (!this.selectedJobId() ||
                        snapshot.job === this.selectedJobId()) &&
                    (!this.selectedDeviceHostname() ||
                        snapshot.device_hostname ===
                            this.selectedDeviceHostname()) &&
                    snapshot.snapshot_type === this.selectedSnapshotType(),
            )
            .map(
                this.snapshotProcessorService.processSnapshot.bind(
                    this.snapshotProcessorService,
                ),
            ),
    );

    constructor(
        private snapshotService: SnapshotService,
        private snapshotProcessorService: SnapshotProcessorService,
    ) {}

    loadSnapshots() {
        this.snapshotService.getSnapshots().subscribe(
            (snapshots) => {
                this.snapshots.set(snapshots);
            },
            (error) => console.error("Error loading snapshots:", error),
        );
    }

    updateSelectedJobId(jobId: string | null) {
        this.selectedJobId.set(jobId);
        this.selectedDeviceHostname.set(null);
    }

    updateSelectedDeviceHostname(hostname: string | null) {
        this.selectedDeviceHostname.set(hostname);
    }

    updateSelectedSnapshotType(type: "pre" | "post") {
        this.selectedSnapshotType.set(type);
    }

    prepareChartData(stats: SessionStats | undefined) {
        return this.snapshotProcessorService.prepareChartData(stats);
    }
}
