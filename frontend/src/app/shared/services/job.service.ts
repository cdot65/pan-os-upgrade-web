// frontend/src/app/shared/services/job.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

import { Injectable } from "@angular/core";
import { Job } from "../interfaces/job.interface";
import { environment } from "../../../environments/environment.prod";

@Injectable({
    providedIn: "root",
})
export class JobService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    getJobs(): Observable<Job[]> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<Job[]>(`${this.apiUrl}/api/v1/jobs/`, { headers })
            .pipe(
                map((jobs) =>
                    jobs.sort(
                        (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime(),
                    ),
                ),
                catchError((error) => {
                    console.error("Error fetching jobs:", error);
                    return of([]);
                }),
            );
    }

    getJob(taskId: string): Observable<Job> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<Job>(`${this.apiUrl}/api/v1/jobs/${taskId}/`, { headers })
            .pipe(
                catchError((error) => {
                    console.error("Error fetching job:", error);
                    throw error;
                }),
            );
    }

    getJobStatus(taskId: string): Observable<string> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .get<Job>(`${this.apiUrl}/api/v1/jobs/${taskId}/`, { headers })
            .pipe(
                map((job) => job.job_status),
                catchError((error) => {
                    console.error("Error fetching job status:", error);
                    return of("errored");
                }),
            );
    }

    deleteJob(uuid: string): Observable<any> {
        const authToken = localStorage.getItem("auth_token");
        const headers = new HttpHeaders().set(
            "Authorization",
            `Token ${authToken}`,
        );
        return this.http
            .delete(`${this.apiUrl}/api/v1/jobs/${uuid}/`, { headers })
            .pipe(
                catchError((error) => {
                    console.error("Error deleting job id:", error);
                    return of(null);
                }),
            );
    }
}
