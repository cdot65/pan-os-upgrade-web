/* eslint-disable @typescript-eslint/naming-convention */
// frontend/src/app/shared/services/elasticsearch.service.ts

import { HttpClient, HttpHeaders } from "@angular/common/http";

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable({
    providedIn: "root",
})
export class ElasticsearchService {
    private apiUrl = "http://localhost:9200";

    constructor(private http: HttpClient) {}

    getAllLogs(): Observable<any> {
        const url = `${this.apiUrl}/python-logs-upgrade-*/_search`;
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
                    },
                },
            ],
        };

        return this.http.post(url, body, { headers });
    }

    getLogsByJobId(jobId: string): Observable<any> {
        const url = `${this.apiUrl}/python-logs-upgrade-*/_search`;
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
                    },
                },
            ],
        };

        return this.http.post(url, body, { headers });
    }
}
