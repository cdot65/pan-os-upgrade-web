// src/app/pages/job-details/job-details.component.ts
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { Observable, Subject, timer } from "rxjs";
import { catchError, map, switchMap, takeUntil, tap } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";
import { AsyncPipe, CommonModule, DatePipe } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { LoggingService } from "../../shared/services/logging.service";
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
import { UpgradeStepService } from "../../shared/services/upgrade-step.service";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";

@Component({
    selector: "app-job-details",
    templateUrl: "./job-details.html",
    styleUrls: ["./job-details.scss"],
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
})
export class JobDetailsComponent implements OnDestroy, OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    // Component page details
    pageTitle = "Job Details";
    pageDescription = "View details and logs for the selected job";
    breadcrumbs = [
        { label: "Home", url: "/" },
        { label: "Jobs", url: "/jobs" },
        { label: "Details", url: "" },
    ];

    jobStatusAndLogs$ = this.loggingService.jobStatusAndLogs$;
    jobStatusDetails$: Observable<any> = this.jobStatusAndLogs$.pipe(
        map((details) => details?.job ?? null),
    );
    jobDetailsTableData$: Observable<{ key: string; value: string }[]>;

    private destroy$ = new Subject<void>();
    private pollingInterval = 3000; // 3 seconds
    private jobUuid: string | null = null;

    constructor(
        private loggingService: LoggingService,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        public sortingService: SortingService,
        public _componentPageTitle: ComponentPageTitle,
        private upgradeStepService: UpgradeStepService,
    ) {
        this.jobDetailsTableData$ = this.initJobDetailsTableData();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = this.pageTitle;
        this.jobUuid = this.route.snapshot.paramMap.get("id");
        if (this.jobUuid) {
            this.fetchInitialJobDetailsAndLogs();
        }
    }

    private fetchInitialJobDetailsAndLogs(): void {
        this.loggingService
            .getJobDetailsAndLogs(this.jobUuid!)
            .pipe(
                tap((jobDetails) => {
                    const sortedLogs = this.sortLogs(jobDetails.logs);
                    this.loggingService.setJobDetailsAndLogs({
                        ...jobDetails,
                        logs: sortedLogs,
                    });
                    this.upgradeStepService.updateCurrentStep(jobDetails.job);
                    if (
                        jobDetails.job.job_status === "pending" ||
                        jobDetails.job.job_status === "running"
                    ) {
                        this.startPolling();
                    }
                }),
                catchError((error) => {
                    console.error(
                        "Error fetching initial job details and logs:",
                        error,
                    );
                    return [];
                }),
            )
            .subscribe();
    }

    private initJobDetailsTableData(): Observable<
        { key: string; value: string }[]
    > {
        return this.jobStatusAndLogs$.pipe(
            map((details) => {
                if (!details?.job) {
                    return [];
                }
                return [
                    { key: "Job Type", value: details.job.job_type },
                    { key: "Created at", value: details.job.created_at },
                    { key: "Updated at", value: details.job.updated_at },
                    { key: "Status", value: details.job.job_status },
                    {
                        key: "Device Group",
                        value: details.job.devices.target.device_group || "N/A",
                    },
                    {
                        key: "HA Enabled",
                        value: details.job.devices.target.ha_enabled
                            ? "Yes"
                            : "No",
                    },
                    {
                        key: "Hostname",
                        value: details.job.devices.target.hostname || "N/A",
                    },
                    {
                        key: "Local State",
                        value: details.job.devices.target.local_state || "N/A",
                    },
                    {
                        key: "Panorama Managed",
                        value: details.job.devices.target.panorama_managed
                            ? "Yes"
                            : "No",
                    },
                    {
                        key: "Peer Device",
                        value: details.job.devices.target.peer_device || "N/A",
                    },
                    {
                        key: "Peer State",
                        value: details.job.devices.target.peer_state || "N/A",
                    },
                    {
                        key: "Platform",
                        value: details.job.devices.target.platform || "N/A",
                    },
                    {
                        key: "Serial",
                        value: details.job.devices.target.serial || "N/A",
                    },
                    {
                        key: "Software Version",
                        value: details.job.devices.target.sw_version || "N/A",
                    },
                ];
            }),
            catchError(() => []),
        );
    }

    private startPolling(): void {
        timer(0, this.pollingInterval)
            .pipe(
                switchMap(() =>
                    this.loggingService.getJobDetailsAndLogs(this.jobUuid!),
                ),
                tap((jobDetails) => {
                    const sortedLogs = this.sortLogs(jobDetails.logs);
                    this.loggingService.setJobDetailsAndLogs({
                        ...jobDetails,
                        logs: sortedLogs,
                    });
                    this.upgradeStepService.updateCurrentStep(jobDetails.job);
                }),
                takeUntil(this.destroy$),
            )
            .subscribe(
                (jobDetails) => {
                    if (
                        jobDetails.job.job_status !== "pending" &&
                        jobDetails.job.job_status !== "running"
                    ) {
                        this.destroy$.next();
                    }
                },
                (error) => {
                    console.error(
                        "Error fetching job details and logs:",
                        error,
                    );
                    this.snackBar.open(
                        "Failed to fetch job details and logs. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    toggleSortOrder() {
        this.sortingService.toggleSortOrder();
        const jobDetails = this.loggingService.getJobDetailsAndLogsValue();
        if (jobDetails) {
            const sortedLogs = this.sortLogs(jobDetails.logs);
            this.loggingService.setJobDetailsAndLogs({
                ...jobDetails,
                logs: sortedLogs,
            });
        }
    }

    private sortLogs(logs: any[]) {
        return this.sortingService.sortOrder() === "asc"
            ? logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            : logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
}
