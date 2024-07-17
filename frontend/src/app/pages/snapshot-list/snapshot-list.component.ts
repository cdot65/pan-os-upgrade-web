/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { MatRadioModule } from "@angular/material/radio";
import { Color, NgxChartsModule, ScaleType } from "@swimlane/ngx-charts";
import { SnapshotService } from "../../shared/services/snapshot.service";
import {
    ArpTableEntry,
    ContentVersion,
    License,
    NetworkInterface,
    Route,
    SessionStats,
    Snapshot,
} from "../../shared/interfaces/snapshot.interface";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { MatIconModule } from "@angular/material/icon";

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
        NgxChartsModule,
    ],
    templateUrl: "./snapshot-list.component.html",
    styleUrls: ["./snapshot-list.component.scss"],
})
export class SnapshotListComponent implements OnInit, OnDestroy {
    snapshots: Snapshot[] = [];
    filteredSnapshots: Snapshot[] = [];
    jobIds: string[] = [];
    deviceUuids: string[] = [];
    deviceHostnames: string[] = [];
    form: FormGroup;

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
    // Chart data
    sessionCountsData: any[] = [];
    sessionRatesData: any[] = [];
    timeoutData: any[] = [];

    // Chart options
    view: [number, number] = [700, 400];
    showXAxis = true;
    showYAxis = true;
    gradient = false;
    showLegend = true;
    showXAxisLabel = true;
    showYAxisLabel = true;
    xAxisLabel = "Type";
    yAxisLabel = "Value";

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
    private destroy$ = new Subject<void>();

    constructor(
        private snapshotService: SnapshotService,
        private fb: FormBuilder,
    ) {
        this.form = this.fb.group({
            jobId: [""],
            deviceHostname: [""],
            snapshotType: ["pre"],
        });
    }

    ngOnInit() {
        this.loadSnapshots();
        this.form.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.filterSnapshots());
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadSnapshots() {
        this.snapshotService
            .getSnapshots()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (snapshots) => {
                    this.snapshots = snapshots;
                    this.jobIds = [...new Set(snapshots.map((s) => s.job))];
                    this.deviceHostnames = [
                        ...new Set(snapshots.map((s) => s.device_hostname)),
                    ];
                    this.filterSnapshots();
                },
                (error) => console.error("Error loading snapshots:", error),
            );
    }

    loadSnapshotsByJobId(jobId: string) {
        if (!jobId) {
            return;
        }
        this.snapshotService
            .getSnapshotsByJobId(jobId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (snapshots) => {
                    this.snapshots = snapshots;
                    this.deviceHostnames = [
                        ...new Set(snapshots.map((s) => s.device_hostname)),
                    ];
                    this.filterSnapshots();
                },
                (error) =>
                    console.error("Error loading snapshots for job:", error),
            );
    }

    filterSnapshots() {
        const { jobId, deviceHostname, snapshotType } = this.form.value;
        this.filteredSnapshots = this.snapshots
            .filter(
                (snapshot) =>
                    (!jobId || snapshot.job === jobId) &&
                    (!deviceHostname ||
                        snapshot.device_hostname === deviceHostname) &&
                    (!snapshotType || snapshot.snapshot_type === snapshotType),
            )
            .map((snapshot) => ({
                ...snapshot,
                content_versions: this.sortContentVersions(
                    snapshot.content_versions,
                ),
                licenses: this.sortLicenses(snapshot.licenses),
                network_interfaces: this.sortNetworkInterfaces(
                    snapshot.network_interfaces,
                ),
                arp_table_entries: this.sortArpTableEntries(
                    snapshot.arp_table_entries,
                ),
                routes: this.sortRoutes(snapshot.routes),
            }));

        if (this.filteredSnapshots.length > 0) {
            this.prepareChartData(this.filteredSnapshots[0].session_stats[0]);
        }
    }

    prepareChartData(stats: SessionStats) {
        this.sessionCountsData = [
            { name: "Active", value: stats.num_active },
            { name: "TCP", value: stats.num_tcp },
            { name: "UDP", value: stats.num_udp },
            { name: "ICMP", value: stats.num_icmp },
        ];

        this.sessionRatesData = [
            { name: "CPS", value: stats.cps },
            { name: "PPS", value: stats.pps },
            { name: "KBPS", value: stats.kbps },
        ];

        this.timeoutData = [
            { name: "TCP", value: stats.tmo_tcp },
            { name: "UDP", value: stats.tmo_udp },
            { name: "ICMP", value: stats.tmo_icmp },
        ];
    }

    sortContentVersions(versions: ContentVersion[]): ContentVersion[] {
        return versions.sort((a, b) => a.version.localeCompare(b.version));
    }

    sortLicenses(licenses: License[]): License[] {
        return licenses.sort((a, b) => a.feature.localeCompare(b.feature));
    }

    sortNetworkInterfaces(interfaces: NetworkInterface[]): NetworkInterface[] {
        return interfaces.sort((a, b) => a.name.localeCompare(b.name));
    }

    sortArpTableEntries(entries: ArpTableEntry[]): ArpTableEntry[] {
        return entries.sort((a, b) => a.ip.localeCompare(b.ip));
    }

    sortRoutes(routes: Route[]): Route[] {
        return routes.sort((a, b) =>
            a.destination.localeCompare(b.destination),
        );
    }

    onSelect(event: any) {
        console.log("Item clicked", JSON.parse(JSON.stringify(event)));
    }
}
