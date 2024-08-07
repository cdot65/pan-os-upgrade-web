/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/job-details/job-details.facade.ts

import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { LoggingService } from "../../shared/services/logging.service";
import { UpgradeStepService } from "../../shared/services/upgrade-step.service";
import { SortingService } from "../../shared/services/sorting.service";

@Injectable()
export class JobDetailsFacade {
    private jobStatusAndLogsSubject = new BehaviorSubject<any>(null);
    jobStatusAndLogs$ = this.jobStatusAndLogsSubject.asObservable();

    constructor(
        private loggingService: LoggingService,
        private upgradeStepService: UpgradeStepService,
        private sortingService: SortingService,
    ) {}

    getJobDetailsAndLogs(jobUuid: string): Observable<any> {
        return this.loggingService.getJobDetailsAndLogs(jobUuid).pipe(
            tap((jobDetails) => {
                const sortedLogs = this.sortLogs(jobDetails.logs);
                this.setJobDetailsAndLogs({ ...jobDetails, logs: sortedLogs });
                this.upgradeStepService.updateCurrentStep(jobDetails.job);
            }),
            catchError((error) => {
                console.error("Error fetching job details and logs:", error);
                throw error;
            }),
        );
    }

    setJobDetailsAndLogs(details: any): void {
        this.jobStatusAndLogsSubject.next(details);
    }

    getJobDetailsAndLogsValue(): any {
        return this.jobStatusAndLogsSubject.getValue();
    }

    toggleSortOrder(): void {
        this.sortingService.toggleSortOrder();
        const jobDetails = this.getJobDetailsAndLogsValue();
        if (jobDetails) {
            const sortedLogs = this.sortLogs(jobDetails.logs);
            this.setJobDetailsAndLogs({ ...jobDetails, logs: sortedLogs });
        }
    }

    private sortLogs(logs: any[]): any[] {
        return this.sortingService.sortOrder() === "asc"
            ? logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
            : logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
}
