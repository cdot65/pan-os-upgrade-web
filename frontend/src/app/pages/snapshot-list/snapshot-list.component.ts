// src/app/snapshots/snapshot-list/snapshot-list.component.ts

import { Component, effect, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { MatRadioModule } from "@angular/material/radio";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { ComponentPageTitle } from "../page-title/page-title";
import { SnapshotListFacade } from "./snapshot-list.facade";
import { chartConfig } from "./chart-config";

@Component({
    selector: "app-snapshot-list",
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatTableModule,
        MatSelectModule,
        MatFormFieldModule,
        MatButtonModule,
        MatRadioModule,
        MatIconModule,
        MatDividerModule,
        NgxChartsModule,
        PageHeaderComponent,
    ],
    providers: [SnapshotListFacade],
    templateUrl: "./snapshot-list.component.html",
    styleUrls: ["./snapshot-list.component.scss"],
})
export class SnapshotListComponent implements OnInit {
    pageTitle = "Snapshot List";
    pageDescription = "View and compare snapshots of device states";
    breadcrumbs = [
        { label: "Home", url: "/" },
        { label: "Snapshots", url: "/snapshots" },
    ];

    snapshotFilterForm: FormGroup;

    private facade = inject(SnapshotListFacade);
    private formBuilder = inject(FormBuilder);
    public _componentPageTitle = inject(ComponentPageTitle);

    // Table columns
    contentVersionColumns: string[] = ["version"];
    licenseColumns: string[] = [
        "feature",
        "description",
        "serial",
        "expires",
        "expired",
    ];
    networkInterfaceColumns: string[] = ["name", "status"];
    arpTableColumns: string[] = [
        "interface",
        "ip",
        "mac",
        "port",
        "status",
        "ttl",
    ];
    routeColumns: string[] = [
        "virtual_router",
        "destination",
        "nexthop",
        "metric",
        "flags",
        "age",
        "interface",
        "route_table",
    ];

    // Chart data and options
    sessionCountsData: any[] = [];
    sessionRatesData: any[] = [];
    timeoutData: any[] = [];
    chartConfig = chartConfig;

    // Expose facade properties
    jobIds = this.facade.jobIds;
    deviceHostnames = this.facade.deviceHostnames;
    filteredSnapshots = this.facade.filteredSnapshots;

    // Expose chart config properties
    view = this.chartConfig.view;
    showXAxis = this.chartConfig.showXAxis;
    showYAxis = this.chartConfig.showYAxis;
    gradient = this.chartConfig.gradient;
    showLegend = this.chartConfig.showLegend;
    showXAxisLabel = this.chartConfig.showXAxisLabel;
    showYAxisLabel = this.chartConfig.showYAxisLabel;
    xAxisLabel = this.chartConfig.xAxisLabel;
    yAxisLabel = this.chartConfig.yAxisLabel;
    colorScheme = this.chartConfig.colorScheme;

    constructor() {
        this.snapshotFilterForm = this.formBuilder.group({
            jobId: [null],
            deviceHostname: [null],
            snapshotType: ["pre"],
        });

        effect(() => {
            const firstSnapshot = this.facade.filteredSnapshots()[0];
            if (
                firstSnapshot &&
                firstSnapshot.session_stats &&
                firstSnapshot.session_stats.length > 0
            ) {
                const chartData = this.facade.prepareChartData(
                    firstSnapshot.session_stats[0],
                );
                this.sessionCountsData = chartData.sessionCountsData;
                this.sessionRatesData = chartData.sessionRatesData;
                this.timeoutData = chartData.timeoutData;
            } else {
                this.sessionCountsData = [];
                this.sessionRatesData = [];
                this.timeoutData = [];
            }
        });
    }

    ngOnInit() {
        this._componentPageTitle.title = this.pageTitle;
        this.facade.loadSnapshots();
        this.setupFormListeners();
    }

    setupFormListeners() {
        this.snapshotFilterForm
            .get("jobId")
            ?.valueChanges.subscribe((value) =>
                this.facade.updateSelectedJobId(value),
            );
        this.snapshotFilterForm
            .get("deviceHostname")
            ?.valueChanges.subscribe((value) =>
                this.facade.updateSelectedDeviceHostname(value),
            );
        this.snapshotFilterForm
            .get("snapshotType")
            ?.valueChanges.subscribe((value) =>
                this.facade.updateSelectedSnapshotType(value),
            );
    }
}
