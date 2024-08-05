// src/app/pages/homepage/homepage.facade.ts

import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { InventoryService } from "../../shared/services/inventory.service";
import { JobService } from "../../shared/services/job.service";
import { Device } from "../../shared/interfaces/device.interface";
import { JobStatus } from "../../shared/interfaces/job.interface";
import { HomepageProcessorService } from "./homepage-processor.service";
import { HomepageConfig } from "./homepage.config";

@Injectable()
export class HomepageFacade {
    private devices$ = new BehaviorSubject<Device[]>([]);
    private jobs$ = new BehaviorSubject<JobStatus[]>([]);

    constructor(
        private inventoryService: InventoryService,
        private jobService: JobService,
        private processor: HomepageProcessorService,
    ) {}

    loadData(): void {
        this.loadDevices();
        this.loadJobs();
    }

    private loadDevices(): void {
        this.inventoryService.getDevices().subscribe(
            (devices) => {
                this.devices$.next(
                    devices.sort((a, b) =>
                        a.hostname.localeCompare(b.hostname),
                    ),
                );
            },
            (error) => console.error("Error fetching inventory items:", error),
        );
    }

    private loadJobs(): void {
        this.jobService.getJobs().subscribe(
            (jobs) => {
                this.jobs$.next(jobs);
            },
            (error) => console.error("Error fetching jobs:", error),
        );
    }

    getPanOsVersionData(): Observable<{ name: string; value: number }[]> {
        return new Observable((observer) => {
            this.devices$.subscribe((devices) => {
                observer.next(
                    this.processor.processVersionData(devices, "sw_version"),
                );
            });
        });
    }

    getAppIdVersionData(): Observable<{ name: string; value: number }[]> {
        return new Observable((observer) => {
            this.devices$.subscribe((devices) => {
                observer.next(
                    this.processor.processVersionData(devices, "app_version"),
                );
            });
        });
    }

    getSwVersionByDeviceGroupData(): Observable<any[]> {
        return new Observable((observer) => {
            this.devices$.subscribe((devices) => {
                observer.next(
                    this.processor.processVersionByDeviceGroupData(
                        devices,
                        "sw_version",
                    ),
                );
            });
        });
    }

    getAppVersionByDeviceGroupData(): Observable<any[]> {
        return new Observable((observer) => {
            this.devices$.subscribe((devices) => {
                observer.next(
                    this.processor.processVersionByDeviceGroupData(
                        devices,
                        "app_version",
                    ),
                );
            });
        });
    }

    getJobData(): Observable<any[]> {
        return new Observable((observer) => {
            this.jobs$.subscribe((jobs) => {
                observer.next(this.processor.processJobData(jobs));
            });
        });
    }

    getConfig(): typeof HomepageConfig {
        return HomepageConfig;
    }
}
