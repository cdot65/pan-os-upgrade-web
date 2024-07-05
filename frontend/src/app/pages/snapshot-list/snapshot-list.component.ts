/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { MatRadioModule } from "@angular/material/radio";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { SnapshotService } from "../../shared/services/snapshot.service";
import { ContentVersion, License, NetworkInterface, Snapshot } from "../../shared/interfaces/snapshot.interface";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { MatIconModule } from "@angular/material/icon";

@Component({
    selector: "app-snapshot-list",
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatTableModule,
        MatSelectModule,
        MatFormFieldModule,
        MatButtonModule,
        MatRadioModule,
        MatIconModule,
        NgxChartsModule,
    ],
    templateUrl: "./snapshot-list.component.html",
    styleUrls: ["./snapshot-list.component.scss"],
})
export class SnapshotListComponent implements OnInit, OnDestroy {
    snapshots: Snapshot[] = [];
    filteredSnapshots: Snapshot[] = [];
    jobIds: string[] = [];
    deviceUuids: string[] = [];
    deviceHostnames: string[] = [];
    form: FormGroup;

    contentVersionColumns: string[] = ["version"];
    licenseColumns: string[] = [
        "feature",
        "description",
        "serial",
        "expires",
        "expired",
    ];
    networkInterfaceColumns: string[] = ["name", "status"];

    private destroy$ = new Subject<void>();

    constructor(
        private snapshotService: SnapshotService,
        private fb: FormBuilder,
    ) {
        this.form = this.fb.group({
            jobId: [""],
            deviceHostname: [""],
            snapshotType: ["pre"],
        });
    }

    ngOnInit() {
        this.loadSnapshots();
        this.form.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.filterSnapshots());
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadSnapshots() {
        this.snapshotService
            .getSnapshots()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (snapshots) => {
                    this.snapshots = snapshots;
                    this.jobIds = [...new Set(snapshots.map((s) => s.job))];
                    this.deviceHostnames = [
                        ...new Set(snapshots.map((s) => s.device_hostname)),
                    ];
                    this.filterSnapshots();
                },
                (error) => console.error("Error loading snapshots:", error),
            );
    }

    loadSnapshotsByJobId(jobId: string) {
        if (!jobId) {
            return;
        }
        this.snapshotService
            .getSnapshotsByJobId(jobId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (snapshots) => {
                    this.snapshots = snapshots;
                    this.deviceHostnames = [
                        ...new Set(snapshots.map((s) => s.device_hostname)),
                    ];
                    this.filterSnapshots();
                },
                (error) =>
                    console.error("Error loading snapshots for job:", error),
            );
    }

    filterSnapshots() {
        const { jobId, deviceHostname, snapshotType } = this.form.value;
        this.filteredSnapshots = this.snapshots
            .filter(
                (snapshot) =>
                    (!jobId || snapshot.job === jobId) &&
                    (!deviceHostname ||
                        snapshot.device_hostname === deviceHostname) &&
                    (!snapshotType || snapshot.snapshot_type === snapshotType),
            )
            .map((snapshot) => ({
                ...snapshot,
                content_versions: this.sortContentVersions(
                    snapshot.content_versions,
                ),
                licenses: this.sortLicenses(snapshot.licenses),
                network_interfaces: this.sortNetworkInterfaces(
                    snapshot.network_interfaces,
                ),
            }));
    }

    sortContentVersions(versions: ContentVersion[]): ContentVersion[] {
        return versions.sort((a, b) => a.version.localeCompare(b.version));
    }

    sortLicenses(licenses: License[]): License[] {
        return licenses.sort((a, b) => a.feature.localeCompare(b.feature));
    }

    sortNetworkInterfaces(interfaces: NetworkInterface[]): NetworkInterface[] {
        return interfaces.sort((a, b) => a.name.localeCompare(b.name));
    }
}
