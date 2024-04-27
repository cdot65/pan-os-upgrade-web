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
import { Subject, forkJoin } from "rxjs";

import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "src/app/shared/footer/footer";
import { Job } from "../../shared/interfaces/job.interface";
import { JobDeleteDialogComponent } from "../job-delete-dialog/job-delete-dialog";
import { JobPageHeader } from "../job-page-header/job-page-header";
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

@Component({
    selector: "app-job-list",
    templateUrl: "./job-list.html",
    styleUrls: ["./job-list.scss"],
    standalone: true,
    imports: [
        Footer,
        JobPageHeader,
        MatCheckboxModule,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
    ],
})
/**
 * Component for displaying the job list.
 */
export class JobListComponent implements OnInit, AfterViewInit, OnDestroy {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    jobItems: Job[] = [];
    displayedColumns: string[] = [
        "select",
        "task_id",
        "job_type",
        "created_at",
        "view_details",
    ];
    selection = new SelectionModel<Job>(true, []);
    dataSource: MatTableDataSource<Job> = new MatTableDataSource<Job>([]);
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

    checkboxLabel(row?: Job): string {
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
        this._componentPageTitle.title = "Job List";
        this.getJobs();
    }

    onDeleteClick(item: Job): void {
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

    onViewClick(item: Job): void {
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
