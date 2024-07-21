// src/app/pages/job-details/job-details.component.ts
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { Observable, of, Subject, timer } from "rxjs";
import { catchError, map, switchMap, takeUntil, tap } from "rxjs/operators";
import { ActivatedRoute } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "src/app/shared/footer/footer";
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
import { UpgradeDiagramComponent } from "../upgrade-diagram";
import { UpgradeStepService } from "../../shared/services/upgrade-step.service";

@Component({
    selector: "app-job-details",
    templateUrl: "./job-details.html",
    styleUrls: ["./job-details.scss"],
    standalone: true,
    imports: [
        CommonModule,
        Footer,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatSelectModule,
        NgxJsonViewerModule,
        UpgradeDiagramComponent,
    ],
})
export class JobDetailsComponent implements OnDestroy, OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    jobDetails$ = this.loggingService.jobDetails$;
    currentStep$: Observable<string> =
        this.upgradeStepService.currentStep$.pipe(map((step) => step ?? ""));
    jobStatus$: Observable<string> = this.jobDetails$.pipe(
        map((details) => details?.job?.job_status ?? ""),
    );
    deviceDetails$: Observable<any> = this.jobDetails$.pipe(
        map((details) => details?.job?.device ?? null),
    );
    jobDetailsTableData$: Observable<{ key: string; value: string }[]> = of([]);

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
    ) {}

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Job Details";
        this.jobUuid = this.route.snapshot.paramMap.get("id");
        if (this.jobUuid) {
            this.fetchInitialJobDetailsAndLogs();
        }
        this.initJobDetailsTableData();
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

    private initJobDetailsTableData(): void {
        this.jobDetailsTableData$ = this.jobDetails$.pipe(
            map((details) => {
                if (!details?.job) {
                    return [];
                }
                return [
                    { key: "Job Type", value: details.job.job_type },
                    {
                        key: "Created at",
                        value: new Date(
                            details.job.created_at,
                        ).toLocaleString(),
                    },
                    {
                        key: "Updated at",
                        value: new Date(
                            details.job.updated_at,
                        ).toLocaleString(),
                    },
                    { key: "Status", value: details.job.job_status },
                    {
                        key: "Device Group",
                        value: details.job.device.device_group || "N/A",
                    },
                    {
                        key: "HA Enabled",
                        value: details.job.device.ha_enabled ? "Yes" : "No",
                    },
                    {
                        key: "Hostname",
                        value: details.job.device.hostname || "N/A",
                    },
                    {
                        key: "Local State",
                        value: details.job.device.local_state || "N/A",
                    },
                    {
                        key: "Panorama Managed",
                        value: details.job.device.panorama_managed
                            ? "Yes"
                            : "No",
                    },
                    {
                        key: "Peer Device",
                        value: details.job.device.peer_device || "N/A",
                    },
                    {
                        key: "Peer State",
                        value: details.job.device.peer_state || "N/A",
                    },
                    {
                        key: "Platform",
                        value: details.job.device.platform || "N/A",
                    },
                    {
                        key: "Serial",
                        value: details.job.device.serial || "N/A",
                    },
                    {
                        key: "Software Version",
                        value: details.job.device.sw_version || "N/A",
                    },
                ];
            }),
            catchError(() => of([])),
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
