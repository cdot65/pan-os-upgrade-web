/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/services/elasticsearch.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable, interval } from "rxjs";

import { Injectable } from "@angular/core";
import { switchMap } from "rxjs/operators";

@Injectable({
    providedIn: "root",
})
export class ElasticsearchService {
    private apiUrl = "http://localhost:9200";

    constructor(private http: HttpClient) {}

    getLogsAll(path: string): Observable<any> {
        const url = `${this.apiUrl}/python-logs-${path}-*/_search`;
        const headers = new HttpHeaders().set(
            "Content-Type",
            "application/json",
        );
        const body = {
            from: 0,
            size: 100,
            query: {
                match_all: {},
            },
            sort: [
                {
                    "@timestamp": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
            ],
        };

        return this.http.post(url, body, { headers });
    }

    getLogsById(
        jobId: string,
        path: string,
        pollingInterval: number,
    ): Observable<any> {
        const url = `${this.apiUrl}/python-logs-${path}-*/_search`;
        const headers = new HttpHeaders().set(
            "Content-Type",
            "application/json",
        );
        const body = {
            from: 0,
            size: 100,
            query: {
                match: {
                    "extra.job_id": jobId,
                },
            },
            sort: [
                {
                    "@timestamp": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
            ],
        };

        return interval(pollingInterval).pipe(
            switchMap(() => this.http.post(url, body, { headers })),
        );
    }

    getLogsByIdOnce(jobId: string, path: string): Observable<any> {
        const url = `${this.apiUrl}/python-logs-${path}-*/_search`;
        const headers = new HttpHeaders().set(
            "Content-Type",
            "application/json",
        );
        const body = {
            from: 0,
            size: 100,
            query: {
                match: {
                    "extra.job_id": jobId,
                },
            },
            sort: [
                {
                    "@timestamp": {
                        order: "asc",
                        unmapped_type: "long",
                    },
                },
            ],
        };

        return this.http.post(url, body, { headers });
    }
}
