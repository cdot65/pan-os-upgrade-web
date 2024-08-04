// src/app/pages/job-list/job-list.ts

import {
    AfterViewInit,
    Component,
    HostBinding,
    OnDestroy,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { forkJoin, Subject } from "rxjs";

import { ComponentPageTitle } from "../page-title/page-title";
import { JobStatus } from "../../shared/interfaces/job.interface";
import { JobDeleteDialogComponent } from "../job-delete-dialog/job-delete-dialog";
import { JobService } from "../../shared/services/job.service";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { SelectionModel } from "@angular/cdk/collections";
import { takeUntil } from "rxjs/operators";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";

@Component({
    selector: "app-job-list",
    templateUrl: "./job-list.html",
    styleUrls: ["./job-list.scss"],
    standalone: true,
    imports: [
        MatCheckboxModule,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
        PageHeaderComponent,
    ],
})
/**
 * Component for displaying the job list.
 */
export class JobListComponent implements OnInit, AfterViewInit, OnDestroy {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;

    // Component page details
    pageTitle = "Job List";
    pageDescription = "View and manage your jobs";
    breadcrumbs = [
        { label: "Home", url: "/" },
        { label: "Jobs", url: "/jobs" },
    ];

    jobItems: JobStatus[] = [];
    displayedColumns: string[] = [
        "select",
        "task_id",
        "job_type",
        "created_at",
        "view_details",
    ];
    selection = new SelectionModel<JobStatus>(true, []);
    dataSource: MatTableDataSource<JobStatus> =
        new MatTableDataSource<JobStatus>([]);
    private destroy$ = new Subject<void>();

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private dialog: MatDialog,
        private jobService: JobService,
        private router: Router,
        private snackBar: MatSnackBar,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }

    checkboxLabel(row?: JobStatus): string {
        if (!row) {
            return `${this.isAllSelected() ? "select" : "deselect"} all`;
        }
        return `${this.selection.isSelected(row) ? "deselect" : "select"} row ${row.job_type}`;
    }

    getJobs(): void {
        this.jobService
            .getJobs()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (items) => {
                    this.jobItems = items;
                    this.jobItems.sort((a, b) =>
                        b.created_at.localeCompare(a.created_at),
                    );
                    this.dataSource = new MatTableDataSource(this.jobItems);
                    this.dataSource.sort = this.sort;
                },
                (error) => {
                    console.error("Error fetching jobs:", error);
                    this.snackBar.open(
                        "Failed to fetch jobs. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected === numRows;
    }

    masterToggle() {
        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            this.dataSource.data.forEach((row) => this.selection.select(row));
        }
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = this.pageTitle;
        this.getJobs();
    }

    onDeleteClick(item: JobStatus): void {
        const dialogRef = this.dialog.open(JobDeleteDialogComponent, {
            width: "300px",
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
                    this.jobService.deleteJob(item.task_id).subscribe(
                        () => {
                            this.getJobs(); // Refresh the job list after deletion
                        },
                        (error) => {
                            console.error("Error deleting job:", error);
                            this.snackBar.open(
                                "Failed to delete job. Please try again.",
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                        },
                    );
                }
            });
    }

    onDeleteSelectedClick() {
        const selectedItems = this.selection.selected;
        const dialogRef = this.dialog.open(JobDeleteDialogComponent, {
            width: "300px",
            data: {
                title: "Confirm Delete",
                // eslint-disable-next-line max-len
                message: `Are you sure you want to delete ${selectedItems.length} selected job(s)?`,
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result: boolean) => {
                if (result) {
                    const deleteRequests = selectedItems.map((item) =>
                        this.jobService.deleteJob(item.task_id),
                    );
                    forkJoin(deleteRequests).subscribe(
                        () => {
                            this.selection.clear();
                            this.getJobs();
                        },
                        (error) => {
                            console.error("Error deleting jobs:", error);
                            this.snackBar.open(
                                "Failed to delete selected jobs. Please try again.",
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                        },
                    );
                }
            });
    }

    onViewClick(item: JobStatus): void {
        this.router.navigate(["/jobs", item.task_id]);
    }

    toggleAllRows() {
        if (this.isAllSelected()) {
            this.selection.clear();
            return;
        }

        this.selection.select(...this.dataSource.data);
    }
}
