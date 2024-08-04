/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/homepage/homepage.ts

import {
    Component,
    HostBinding,
    Inject,
    OnDestroy,
    OnInit,
    Optional,
} from "@angular/core";
import { ANIMATION_MODULE_TYPE } from "@angular/platform-browser/animations";
import { Device } from "../../shared/interfaces/device.interface";
import { MatSnackBar } from "@angular/material/snack-bar";

import { MatButtonModule } from "@angular/material/button";
import { RouterLink } from "@angular/router";
import { ComponentPageTitle } from "../page-title/page-title";
import { NavigationFocus } from "../../shared/navigation-focus/navigation-focus";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatCardModule } from "@angular/material/card";
import { GuideItems } from "../../shared/guide-items/guide-items";
import { NgFor } from "@angular/common";
import { YouTubePlayer } from "@angular/youtube-player";
import { InventoryService } from "../../shared/services/inventory.service";

import { Carousel, CarouselItem } from "../../shared/carousel/carousel";
import {
    Color,
    NgxChartsModule,
    PieChartModule,
    ScaleType,
} from "@swimlane/ngx-charts";
import { takeUntil } from "rxjs/operators";
import { Subject } from "rxjs";
import { JobService } from "../../shared/services/job.service";
import { JobStatus } from "../../shared/interfaces/job.interface";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";

@Component({
    selector: "app-homepage",
    templateUrl: "./homepage.html",
    styleUrls: ["./homepage.scss"],
    standalone: true,
    imports: [
        NavigationFocus,
        MatButtonModule,
        RouterLink,
        MatDividerModule,
        MatIconModule,
        Carousel,
        NgFor,
        PageHeaderComponent,
        CarouselItem,
        MatCardModule,
        YouTubePlayer,
        NgxChartsModule,
        PieChartModule,
    ],
})
export class Homepage implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    @HostBinding("class.animations-disabled")
    // Properties for component
    pageTitle = "Dashboard";
    breadcrumbs = [
        { label: "Home", url: "/" },
        { label: "Dashboard", url: "/" },
    ];
    pageDescription = "Overview of PAN-OS upgrades and statistics";

    readonly animationsDisabled: boolean;
    private destroy$ = new Subject<void>();
    inventoryItems: Device[] = [];

    // Properties for the PAN-OS and App-ID version charts
    appIdVersionData: { name: string; value: number }[] = [];
    panOsVersionData: { name: string; value: number }[] = [];
    view: [number, number] = [700, 400];
    gradient = true;
    colorScheme: Color = {
        name: "custom",
        selectable: true,
        group: ScaleType.Ordinal,
        domain: [
            "#04B3D9",
            "#AE6321",
            "#D96704",
            "#248FA6",
            "#84562F",
            "#306773",
            "#59422E",
            "#283B40",
            "#332A23",
            "#2A3133",
            "#D9D0C3",
            "#C2DCF2",
            "#FFE1B3",
            "#A2D3FF",
            "#FFCE80",
            "#735D39",
            "#303D48",
            "#395873",
            "#40382D",
            "#A6B8C8",
        ],
    };

    // Properties for the grouped app_version chart
    appVersionByDeviceGroupData: any[] = [];
    appVersionChartView: [number, number] = [700, 400];
    appVersionLegendTitle: string = "App-ID Version";
    appVersionShowLegend: boolean = true;
    appVersionShowXAxis: boolean = true;
    appVersionShowYAxis: boolean = true;
    appVersionShowXAxisLabel: boolean = true;
    appVersionShowYAxisLabel: boolean = true;
    appVersionXAxisLabel: string = "Count";
    appVersionYAxisLabel: string = "Device Group";

    // Properties for the Job Data chart
    jobData: any[] = [];
    jobChartView: [number, number] = [700, 400];
    jobLegendTitle: string = "Job Status";
    jobShowLegend: boolean = true;
    jobShowXAxis: boolean = true;
    jobShowXAxisLabel: boolean = true;
    jobShowYAxis: boolean = true;
    jobShowYAxisLabel: boolean = true;
    jobXAxisLabel: string = "Count";
    jobYAxisLabel: string = "Job Type";

    // Properties for the grouped sw_version chart
    swVersionByDeviceGroupData: any[] = [];
    swVersionChartView: [number, number] = [700, 400];
    swVersionLegendTitle: string = "PAN-OS Version";
    swVersionShowLegend: boolean = true;
    swVersionShowXAxis: boolean = true;
    swVersionShowYAxis: boolean = true;
    swVersionShowXAxisLabel: boolean = true;
    swVersionShowYAxisLabel: boolean = true;
    swVersionXAxisLabel: string = "Count";
    swVersionYAxisLabel: string = "Device Group";

    constructor(
        public _componentPageTitle: ComponentPageTitle,
        public guideItems: GuideItems,
        private inventoryService: InventoryService,
        private jobService: JobService,
        private snackBar: MatSnackBar,
        @Optional() @Inject(ANIMATION_MODULE_TYPE) animationsModule?: string,
    ) {
        this.animationsDisabled = animationsModule === "NoopAnimations";
    }

    /**
     * Retrieves devices from the inventory service and updates the component's inventoryItems and dataSource properties
     *
     * @returns
     */
    getDevices(): void {
        this.inventoryService
            .getDevices()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (items) => {
                    this.inventoryItems = items;
                    this.inventoryItems.sort((a, b) =>
                        a.hostname.localeCompare(b.hostname),
                    );
                    this.updatePanOsVersionChart();
                    this.updateAppIdVersionChart();
                    this.updateSwVersionByDeviceGroupChart();
                    this.updateAppVersionByDeviceGroupChart();
                },
                (error) => {
                    console.error("Error fetching inventory items:", error);
                    this.snackBar.open(
                        "Failed to fetch inventory items. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    getJobs(): void {
        this.jobService
            .getJobs()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (jobs) => {
                    this.prepareJobChartData(jobs);
                },
                (error) => {
                    console.error("Error fetching jobs:", error);
                    this.snackBar.open(
                        "Failed to fetch jobs. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    /**
     * Method to destroy the component and clean up resources.
     * It completes the subject 'destroy$' and emits the complete signal using 'next()' method.
     *
     * @returns Indicates that the component has been destroyed.
     */
    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Dashboard";
        this.getDevices();
        this.getJobs();
    }

    updatePanOsVersionChart(): void {
        const versionCounts = new Map<string, number>();

        this.inventoryItems.forEach((device: Device) => {
            if (device.sw_version) {
                const count: number = versionCounts.get(device.sw_version) || 0;
                versionCounts.set(device.sw_version, count + 1);
            }
        });

        this.panOsVersionData = Array.from(versionCounts, ([name, value]) => ({
            name,
            value,
        }));
    }

    updateAppIdVersionChart(): void {
        const versionCounts = new Map<string, number>();

        this.inventoryItems.forEach((device: Device): void => {
            if (device.app_version) {
                const count: number =
                    versionCounts.get(device.app_version) || 0;
                versionCounts.set(device.app_version, count + 1);
            }
        });

        this.appIdVersionData = Array.from(versionCounts, ([name, value]) => ({
            name,
            value,
        }));
    }

    prepareJobChartData(jobs: JobStatus[]): void {
        const jobTypeMap = new Map<string, Map<string, number>>();

        jobs.forEach((job) => {
            if (!jobTypeMap.has(job.job_type)) {
                jobTypeMap.set(job.job_type, new Map<string, number>());
            }
            const statusMap = jobTypeMap.get(job.job_type)!;
            statusMap.set(
                job.job_status,
                (statusMap.get(job.job_status) || 0) + 1,
            );
        });

        this.jobData = Array.from(jobTypeMap.entries()).map(
            ([jobType, statusMap]) => ({
                name: jobType,
                series: Array.from(statusMap.entries()).map(
                    ([status, count]) => ({
                        name: status,
                        value: count,
                    }),
                ),
            }),
        );
    }

    updateAppVersionByDeviceGroupChart(): void {
        const groupData = new Map<string, Map<string, number>>();

        this.inventoryItems.forEach((device: Device) => {
            if (device.device_group && device.app_version) {
                if (!groupData.has(device.device_group)) {
                    groupData.set(
                        device.device_group,
                        new Map<string, number>(),
                    );
                }
                const versionMap = groupData.get(device.device_group)!;
                versionMap.set(
                    device.app_version,
                    (versionMap.get(device.app_version) || 0) + 1,
                );
            }
        });

        this.appVersionByDeviceGroupData = Array.from(groupData.entries()).map(
            ([deviceGroup, versionMap]) => ({
                name: deviceGroup,
                series: Array.from(versionMap.entries()).map(
                    ([version, count]) => ({
                        name: version,
                        value: count,
                    }),
                ),
            }),
        );
    }

    updateSwVersionByDeviceGroupChart(): void {
        const groupData = new Map<string, Map<string, number>>();

        this.inventoryItems.forEach((device: Device) => {
            if (device.device_group && device.sw_version) {
                if (!groupData.has(device.device_group)) {
                    groupData.set(
                        device.device_group,
                        new Map<string, number>(),
                    );
                }
                const versionMap = groupData.get(device.device_group)!;
                versionMap.set(
                    device.sw_version,
                    (versionMap.get(device.sw_version) || 0) + 1,
                );
            }
        });

        this.swVersionByDeviceGroupData = Array.from(groupData.entries()).map(
            ([deviceGroup, versionMap]) => ({
                name: deviceGroup,
                series: Array.from(versionMap.entries()).map(
                    ([version, count]) => ({
                        name: version,
                        value: count,
                    }),
                ),
            }),
        );
    }
}
