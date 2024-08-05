/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MatTableModule } from "@angular/material/table";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatButtonModule } from "@angular/material/button";
import { MatRadioModule } from "@angular/material/radio";
import { MatIconModule } from "@angular/material/icon";
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
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { ComponentPageTitle } from "../page-title/page-title";
import { MatDividerModule } from "@angular/material/divider";

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
    templateUrl: "./snapshot-list.component.html",
    styleUrls: ["./snapshot-list.component.scss"],
})
export class SnapshotListComponent implements OnInit {
    // Component page details
    pageTitle = "Snapshot List";
    pageDescription = "View and compare snapshots of device states";
    breadcrumbs = [
        { label: "Home", url: "/" },
        { label: "Snapshots", url: "/snapshots" },
    ];

    snapshotFilterForm: FormGroup;

    private snapshotService = inject(SnapshotService);
    private destroyRef = inject(DestroyRef);

    snapshots = signal<Snapshot[]>([]);
    selectedJobId = signal<string | null>(null);
    selectedDeviceHostname = signal<string | null>(null);
    selectedSnapshotType = signal<"pre" | "post">("pre");

    jobIds = computed(() => [...new Set(this.snapshots().map((s) => s.job))]);
    deviceHostnames = computed(() => {
        const jobId = this.selectedJobId();
        return [
            ...new Set(
                this.snapshots()
                    .filter((s) => !jobId || s.job === jobId)
                    .map((s) => s.device_hostname),
            ),
        ];
    });

    filteredSnapshots = computed(() =>
        this.snapshots()
            .filter(
                (snapshot) =>
                    (!this.selectedJobId() ||
                        snapshot.job === this.selectedJobId()) &&
                    (!this.selectedDeviceHostname() ||
                        snapshot.device_hostname ===
                            this.selectedDeviceHostname()) &&
                    snapshot.snapshot_type === this.selectedSnapshotType(),
            )
            .map(this.processSnapshot.bind(this)),
    );

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

    // Chart data as regular properties
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

    constructor(
        public _componentPageTitle: ComponentPageTitle,
        private formBuilder: FormBuilder,
    ) {
        this.snapshotFilterForm = this.formBuilder.group({
            jobId: [null],
            deviceHostname: [null],
            snapshotType: ["pre"],
        });
        effect(() => {
            const firstSnapshot = this.filteredSnapshots()[0];
            if (
                firstSnapshot &&
                firstSnapshot.session_stats &&
                firstSnapshot.session_stats.length > 0
            ) {
                this.prepareChartData(firstSnapshot.session_stats[0]);
            } else {
                this.clearChartData();
            }
        });
    }

    ngOnInit() {
        this._componentPageTitle.title = this.pageTitle;
        this.loadSnapshots();
        this.setupFormListeners();
    }

    setupFormListeners() {
        this.snapshotFilterForm
            .get("jobId")
            ?.valueChanges.subscribe((value) =>
                this.updateSelectedJobId(value),
            );
        this.snapshotFilterForm
            .get("deviceHostname")
            ?.valueChanges.subscribe((value) =>
                this.updateSelectedDeviceHostname(value),
            );
        this.snapshotFilterForm
            .get("snapshotType")
            ?.valueChanges.subscribe((value) =>
                this.updateSelectedSnapshotType(value),
            );
    }

    updateSelectedJobId(jobId: string | null) {
        this.selectedJobId.set(jobId);
        this.selectedDeviceHostname.set(null);
        this.snapshotFilterForm.patchValue(
            { deviceHostname: null },
            { emitEvent: false },
        );
    }

    loadSnapshots() {
        this.snapshotService
            .getSnapshots()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(
                (snapshots) => {
                    this.snapshots.set(snapshots);
                },
                (error) => console.error("Error loading snapshots:", error),
            );
    }

    updateSelectedDeviceHostname(hostname: string | null) {
        this.selectedDeviceHostname.set(hostname);
    }

    updateSelectedSnapshotType(type: "pre" | "post") {
        this.selectedSnapshotType.set(type);
    }

    private processSnapshot(snapshot: Snapshot): Snapshot {
        return {
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
        };
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

    prepareChartData(stats: SessionStats | undefined) {
        if (!stats) {
            this.clearChartData();
            return;
        }

        this.sessionCountsData = [
            { name: "Active", value: stats.num_active || 0 },
            { name: "TCP", value: stats.num_tcp || 0 },
            { name: "UDP", value: stats.num_udp || 0 },
            { name: "ICMP", value: stats.num_icmp || 0 },
        ];

        this.sessionRatesData = [
            { name: "CPS", value: stats.cps || 0 },
            { name: "PPS", value: stats.pps || 0 },
            { name: "KBPS", value: stats.kbps || 0 },
        ];

        this.timeoutData = [
            { name: "TCP", value: stats.tmo_tcp || 0 },
            { name: "UDP", value: stats.tmo_udp || 0 },
            { name: "ICMP", value: stats.tmo_icmp || 0 },
        ];
    }

    clearChartData() {
        this.sessionCountsData = [];
        this.sessionRatesData = [];
        this.timeoutData = [];
    }
}
