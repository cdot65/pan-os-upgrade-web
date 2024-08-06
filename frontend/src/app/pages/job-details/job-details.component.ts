// src/app/pages/job-details/job-details.component.ts
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { Observable, Subject, timer } from "rxjs";
import { map, switchMap, takeUntil } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";
import { AsyncPipe, CommonModule, DatePipe } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { NgxJsonViewerModule } from "ngx-json-viewer";
import { SortingService } from "../../shared/services/sorting.service";
import { FirewallDiagramComponent } from "../firewall-diagram";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { JOB_DETAILS_CONFIG } from "./job-details.config";
import { JobDetailsFacade } from "./job-details.facade";
import { JobDetailsProcessorService } from "./job-details.processor.service";

@Component({
    selector: "app-job-details",
    templateUrl: "./job-details.component.html",
    styleUrls: ["./job-details.component.scss"],
    standalone: true,
    imports: [
        AsyncPipe,
        CommonModule,
        DatePipe,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatSelectModule,
        NgxJsonViewerModule,
        FirewallDiagramComponent,
        PageHeaderComponent,
    ],
    providers: [JobDetailsFacade],
})
export class JobDetailsComponent implements OnDestroy, OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    config = JOB_DETAILS_CONFIG;
    jobStatusAndLogs$ = this.facade.jobStatusAndLogs$;
    jobStatusDetails$: Observable<any>;
    jobDetailsTableData$: Observable<{ key: string; value: string }[]>;
    logs$ = this.jobStatusAndLogs$.pipe(map((details) => details?.logs ?? []));

    private destroy$ = new Subject<void>();
    private jobUuid: string | null = null;

    constructor(
        private facade: JobDetailsFacade,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        public sortingService: SortingService,
        public _componentPageTitle: ComponentPageTitle,
        private processor: JobDetailsProcessorService,
    ) {
        this.jobStatusDetails$ = this.jobStatusAndLogs$.pipe(
            map((details: { job: any }) => details?.job ?? null),
        );
        this.jobDetailsTableData$ = this.jobStatusAndLogs$.pipe(
            map((details: any) =>
                this.processor.processJobDetailsTableData(details),
            ),
        );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = this.config.pageTitle;
        this.jobUuid = this.route.snapshot.paramMap.get("id");
        if (this.jobUuid) {
            this.fetchInitialJobDetailsAndLogs();
        }
    }

    private fetchInitialJobDetailsAndLogs(): void {
        this.facade.getJobDetailsAndLogs(this.jobUuid!).subscribe({
            next: (jobDetails) => {
                if (this.processor.isJobInProgress(jobDetails.job.job_status)) {
                    this.startPolling();
                }
            },
            error: (error) => {
                console.error(
                    "Error fetching initial job details and logs:",
                    error,
                );
                this.snackBar.open(
                    "Failed to fetch job details and logs. Please try again.",
                    "Close",
                    { duration: this.config.snackBarDuration },
                );
            },
        });
    }

    private startPolling(): void {
        timer(0, this.config.pollingInterval)
            .pipe(
                switchMap(() =>
                    this.facade.getJobDetailsAndLogs(this.jobUuid!),
                ),
                takeUntil(this.destroy$),
            )
            .subscribe({
                next: (jobDetails) => {
                    if (
                        !this.processor.isJobInProgress(
                            jobDetails.job.job_status,
                        )
                    ) {
                        this.destroy$.next();
                    }
                },
                error: (error) => {
                    console.error(
                        "Error fetching job details and logs:",
                        error,
                    );
                    this.snackBar.open(
                        "Failed to fetch job details and logs. Please try again.",
                        "Close",
                        { duration: this.config.snackBarDuration },
                    );
                },
            });
    }

    toggleSortOrder() {
        this.facade.toggleSortOrder();
    }
}
