import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { SnapshotService } from "../../shared/services/snapshot.service";
import { Snapshot } from "../../shared/interfaces/snapshot.interface";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

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
        NgxChartsModule,
    ],
    templateUrl: "./snapshot-list.component.html",
    styleUrls: ["./snapshot-list.component.scss"],
})
export class SnapshotListComponent implements OnInit, OnDestroy {
    snapshots: Snapshot[] = [];
    jobIds: string[] = [];
    selectedSnapshot: Snapshot | null = null;
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
        });
    }

    ngOnInit() {
        this.loadSnapshots();
        this.form
            .get("jobId")
            ?.valueChanges.pipe(takeUntil(this.destroy$))
            .subscribe((jobId) => this.loadSnapshotsByJobId(jobId));
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
                    this.selectedSnapshot = snapshots[0];
                },
                (error) =>
                    console.error("Error loading snapshots for job:", error),
            );
    }
}
