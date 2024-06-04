/* eslint-disable @typescript-eslint/naming-convention */
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { Subject, timer } from "rxjs";
import { switchMap, takeUntil } from "rxjs/operators";

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
    ],
})
export class JobDetailsComponent implements OnDestroy, OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    jobDetails$ = this.loggingService.jobDetails$;
    private destroy$ = new Subject<void>();
    private pollingInterval = 3000; // 3 seconds

    constructor(
        private loggingService: LoggingService,
        private route: ActivatedRoute,
        private snackBar: MatSnackBar,
        public sortingService: SortingService,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Job Details";
        const jobUuid = this.route.snapshot.paramMap.get("id");
        if (jobUuid) {
            this.fetchJobDetailsAndLogs(jobUuid);
        }
    }

    private fetchJobDetailsAndLogs(jobUuid: string): void {
        timer(0, this.pollingInterval)
            .pipe(
                switchMap(() =>
                    this.loggingService.getJobDetailsAndLogs(jobUuid),
                ),
                takeUntil(this.destroy$),
            )
            .subscribe(
                (jobDetails) => {
                    const sortedLogs = this.sortLogs(jobDetails.logs);
                    this.loggingService.setJobDetailsAndLogs({
                        ...jobDetails,
                        logs: sortedLogs,
                    });
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
    }

    private sortLogs(logs: any[]) {
        return this.sortingService.sortOrder() === "asc"
            ? logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            : logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
}
