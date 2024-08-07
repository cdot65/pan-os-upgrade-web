/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/job-list/job-list.component.ts

import {
    ChangeDetectionStrategy,
    Component,
    HostBinding,
    OnDestroy,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { ComponentPageTitle } from "../page-title/page-title";
import { JobStatus } from "../../shared/interfaces/job.interface";
import { JobDeleteDialogComponent } from "../job-delete-dialog/job-delete-dialog";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { SelectionModel } from "@angular/cdk/collections";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { JOB_LIST_CONFIG } from "./job-list.config";
import { JobListFacade } from "./job-list.facade";
import { JobListProcessorService } from "./job-list.processor.service";
import { DatePipe } from "@angular/common";

@Component({
    selector: "app-job-list",
    templateUrl: "./job-list.component.html",
    styleUrls: ["./job-list.component.scss"],
    standalone: true,
    imports: [
        MatCheckboxModule,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
        PageHeaderComponent,
        DatePipe,
    ],
    providers: [JobListFacade, JobListProcessorService],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobListComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    @ViewChild(MatSort) sort!: MatSort;

    config = JOB_LIST_CONFIG;
    dataSource: MatTableDataSource<JobStatus> =
        new MatTableDataSource<JobStatus>([]);
    selection = new SelectionModel<JobStatus>(true, []);

    private destroy$ = new Subject<void>();

    constructor(
        private dialog: MatDialog,
        private router: Router,
        private snackBar: MatSnackBar,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
        private facade: JobListFacade,
        private processor: JobListProcessorService,
    ) {}

    ngOnInit(): void {
        this._componentPageTitle.title = this.config.pageTitle;
        this.loadJobs();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadJobs(): void {
        this.facade
            .getJobs()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (jobs) => {
                    this.dataSource.data = jobs;
                    this.dataSource.sort = this.sort;
                },
                error: (error) => {
                    console.error("Error fetching jobs:", error);
                    this.snackBar.open(
                        "Failed to fetch jobs. Please try again.",
                        "Close",
                        {
                            duration: this.config.snackBarDuration,
                        },
                    );
                },
            });
    }

    async announceSortChange(sortState: Sort): Promise<void> {
        try {
            if (sortState.direction) {
                await this._liveAnnouncer.announce(
                    `Sorted ${sortState.direction}ending`,
                );
            } else {
                await this._liveAnnouncer.announce("Sorting cleared");
            }
        } catch (error) {
            console.error("Error announcing sort change:", error);
        }
    }

    isAllSelected(): boolean {
        return this.processor.isAllSelected(
            this.selection.selected,
            this.dataSource.data,
        );
    }

    masterToggle(): void {
        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            this.dataSource.data.forEach((row) => this.selection.select(row));
        }
    }

    checkboxLabel(row?: JobStatus): string {
        return this.processor.checkboxLabel(this.isAllSelected(), row);
    }

    onDeleteClick(item: JobStatus): void {
        const dialogRef = this.dialog.open(JobDeleteDialogComponent, {
            width: this.config.deleteDialogWidth,
            data: {
                title: "Confirm Delete",
                message: "Are you sure you want to delete this job?",
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result: boolean) => {
                if (result) {
                    this.facade.deleteJob(item.task_id).subscribe({
                        next: () => this.loadJobs(),
                        error: (error) => {
                            console.error("Error deleting job:", error);
                            this.snackBar.open(
                                "Failed to delete job. Please try again.",
                                "Close",
                                {
                                    duration: this.config.snackBarDuration,
                                },
                            );
                        },
                    });
                }
            });
    }

    onDeleteSelectedClick(): void {
        const selectedItems = this.selection.selected;
        const dialogRef = this.dialog.open(JobDeleteDialogComponent, {
            width: this.config.deleteDialogWidth,
            data: {
                title: "Confirm Delete",
                message: `Are you sure you want to delete ${selectedItems.length} selected job(s)?`,
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result: boolean) => {
                if (result) {
                    const taskIds = selectedItems.map((item) => item.task_id);
                    this.facade.deleteMultipleJobs(taskIds).subscribe({
                        next: () => {
                            this.selection.clear();
                            this.loadJobs();
                        },
                        error: (error) => {
                            console.error("Error deleting jobs:", error);
                            this.snackBar.open(
                                "Failed to delete selected jobs. Please try again.",
                                "Close",
                                {
                                    duration: this.config.snackBarDuration,
                                },
                            );
                        },
                    });
                }
            });
    }

    async onViewClick(item: JobStatus): Promise<void> {
        try {
            await this.router.navigate(["/jobs", item.task_id]);
        } catch (error) {
            console.error("Navigation error:", error);
        }
    }
}
