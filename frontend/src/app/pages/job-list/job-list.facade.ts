/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/job-list/job-list.facade.ts

import { Injectable } from "@angular/core";
import { BehaviorSubject, forkJoin, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { JobService } from "../../shared/services/job.service";
import { JobStatus } from "../../shared/interfaces/job.interface";

@Injectable()
export class JobListFacade {
    private jobItemsSubject = new BehaviorSubject<JobStatus[]>([]);
    jobItems$ = this.jobItemsSubject.asObservable();

    constructor(private jobService: JobService) {}

    getJobs(): Observable<JobStatus[]> {
        return this.jobService.getJobs().pipe(
            map((items) =>
                items.sort((a, b) => b.created_at.localeCompare(a.created_at)),
            ),
            map((items) => {
                this.jobItemsSubject.next(items);
                return items;
            }),
        );
    }

    deleteJob(taskId: string): Observable<any> {
        return this.jobService.deleteJob(taskId);
    }

    deleteMultipleJobs(taskIds: string[]): Observable<any[]> {
        const deleteRequests = taskIds.map((id) =>
            this.jobService.deleteJob(id),
        );
        return forkJoin(deleteRequests);
    }
}
