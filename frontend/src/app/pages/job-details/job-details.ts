/* eslint-disable @typescript-eslint/naming-convention */
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";

import { ActivatedRoute } from "@angular/router";
import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { ElasticsearchService } from "../../shared/services/elasticsearch.service";
import { Footer } from "src/app/shared/footer/footer";
import { Job } from "../../shared/interfaces/job.interface";
import { JobPageHeader } from "../job-page-header/job-page-header";
import { JobService } from "../../shared/services/job.service";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { NgxJsonViewerModule } from "ngx-json-viewer";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-job-details",
    templateUrl: "./job-details.html",
    styleUrls: ["./job-details.scss"],
    standalone: true,
    imports: [
        CommonModule,
        Footer,
        JobPageHeader,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        NgxJsonViewerModule,
    ],
})
export class JobDetailsComponent implements OnDestroy, OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inactivityTimer$ = new Subject<void>();
    jobItem: Job | undefined;
    jobId: string | null = null;
    logs: any[] = [];
    parsedJsonData: any;
    pollingEnabled = true;
    pollingIntervalOptions = [0, 1000, 3000, 5000, 10000, 30000];
    selectedPollingInterval = 3000; // Default polling interval
    private destroy$ = new Subject<void>();

    constructor(
        private jobService: JobService,
        private elasticsearchService: ElasticsearchService,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    fetchLogsOnce(jobId: string) {
        this.elasticsearchService
            .getLogsByJobIdOnce(jobId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (result) => {
                    this.logs = result.hits.hits;
                },
                (error) => {
                    console.error("Error fetching logs:", error);
                    this.snackBar.open(
                        "Failed to fetch logs. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    getJob(itemId: string): void {
        this.jobService
            .getJob(itemId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (item: Job) => {
                    this.jobItem = item;
                    this.parsedJsonData = JSON.parse(item.json_data);
                    this.subscribeToLogs(item.task_id); // Call subscribeToLogs() instead
                },
                (error: any) => {
                    console.error("Error fetching job item:", error);
                    this.snackBar.open(
                        "Failed to fetch job item. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Job Details";
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.getJob(itemId);
            this.fetchLogsOnce(itemId);
            this.subscribeToLogs(itemId);
        }
    }

    subscribeToLogs(jobId: string) {
        if (this.selectedPollingInterval === 0) {
            this.pollingEnabled = false;
            return;
        }

        this.pollingEnabled = true;
        this.elasticsearchService
            .getLogsByJobId(jobId, this.selectedPollingInterval)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (result) => {
                    this.logs = result.hits.hits;
                },
                (error) => {
                    console.error("Error searching logs by job ID:", error);
                    this.snackBar.open(
                        "Failed to fetch logs. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    onPollingIntervalChange() {
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.subscribeToLogs(itemId);
        }
    }
}
