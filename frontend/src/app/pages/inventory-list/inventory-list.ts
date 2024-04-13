/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/inventory-list/inventory-list.ts

import {
    AfterViewInit,
    Component,
    HostBinding,
    OnDestroy,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { Subject, forkJoin } from "rxjs";

import { ComponentPageTitle } from "../page-title/page-title";
import { Device } from "../../shared/interfaces/device.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryDeleteDialogComponent } from "../inventory-delete-dialog/inventory-delete-dialog";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryService } from "../../shared/services/inventory.service";
import { InventorySyncForm } from "../../shared/interfaces/inventory-sync-form.interface";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileDialogComponent } from "../profile-select-dialog/profile-select-dialog.component";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { SelectionModel } from "@angular/cdk/collections";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-inventory-list",
    templateUrl: "./inventory-list.html",
    styleUrls: ["./inventory-list.scss"],
    standalone: true,
    imports: [
        Footer,
        InventoryPageHeader,
        MatCheckboxModule,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatProgressBarModule,
    ],
})
/**
 * Component for displaying the inventory list.
 */
export class InventoryList implements OnInit, AfterViewInit, OnDestroy {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryItems: Device[] = [];
    displayedColumns: string[] = [
        "select",
        "hostname",
        // "notes",
        "management_ip",
        "device_type",
        "device_group",
        "ha",
        "sw_version",
        "app_version",
        "details",
    ];
    dataSource: MatTableDataSource<Device> = new MatTableDataSource<Device>([]);
    jobId: string | null = null;
    panoramaDevices: Device[] = [];
    profiles: Profile[] = [];
    refreshJobsCompleted: number = 0;
    selection = new SelectionModel<Device>(true, []);
    showRefreshError: boolean = false;
    showRefreshProgress: boolean = false;
    showSyncError: boolean = false;
    showSyncProgress: boolean = false;
    syncJobId: string | null = null;
    syncJobsCompleted: number = 0;
    totalRefreshJobs: number = 0;
    totalSyncJobs: number = 0;
    private syncRetryCount = 0;
    private retryCount = 0;
    private destroy$ = new Subject<void>();

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private dialog: MatDialog,
        private inventoryService: InventoryService,
        private profileService: ProfileService,
        private router: Router,
        private snackBar: MatSnackBar,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }

    checkboxLabel(row?: Device): string {
        if (!row) {
            return `${this.isAllSelected() ? "select" : "deselect"} all`;
        }
        return `${this.selection.isSelected(row) ? "deselect" : "select"} row ${row.hostname}`;
    }

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
                    this.dataSource = new MatTableDataSource(
                        this.inventoryItems,
                    );
                    this.dataSource.sort = this.sort;
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

    getJobStatus(jobId: string): void {
        this.inventoryService
            .getJobStatus(jobId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (response) => {
                    if (response.status === "completed") {
                        this.refreshJobsCompleted++;
                        if (
                            this.refreshJobsCompleted === this.totalRefreshJobs
                        ) {
                            this.showRefreshProgress = false;
                            this.getDevices();
                            this.retryCount = 0;
                        }
                    } else {
                        setTimeout(() => this.getJobStatus(jobId), 2000);
                    }
                },
                (error) => {
                    console.error("Error checking job status:", error);
                    if (error.status === 400 && this.retryCount < 3) {
                        this.retryCount++;
                        console.log(
                            `Retrying job status check (attempt ${this.retryCount})`,
                        );
                        setTimeout(() => this.getJobStatus(jobId), 2000);
                    } else {
                        this.showRefreshProgress = false;
                        this.showRefreshError = true;
                        this.retryCount = 0;
                        this.snackBar.open(
                            "Failed to check job status. Please try again.",
                            "Close",
                            {
                                duration: 3000,
                            },
                        );
                    }
                },
            );
    }

    getPanoramaDevices(): void {
        this.inventoryService.getPanoramaDevices().subscribe(
            (devices) => {
                this.panoramaDevices = devices;
            },
            (error) => {
                console.error("Error fetching Panorama devices:", error);
            },
        );
    }

    getProfiles(): void {
        this.profileService.getProfiles().subscribe(
            (profiles) => {
                this.profiles = profiles;
            },
            (error) => {
                console.error("Error fetching profiles:", error);
            },
        );
    }

    getSyncJobStatus(jobId: string): void {
        this.inventoryService
            .getJobStatus(jobId)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (response) => {
                    if (response.status === "completed") {
                        this.syncJobsCompleted++;
                        if (this.syncJobsCompleted === this.totalSyncJobs) {
                            this.showSyncProgress = false;
                            this.getDevices();
                            this.syncRetryCount = 0;
                        }
                    } else {
                        setTimeout(() => this.getSyncJobStatus(jobId), 2500);
                    }
                },
                (error) => {
                    console.error("Error checking sync job status:", error);
                    if (error.status === 400 && this.syncRetryCount < 3) {
                        this.syncRetryCount++;
                        console.log(
                            `Retrying sync job status check (attempt ${this.syncRetryCount})`,
                        );
                        setTimeout(() => this.getSyncJobStatus(jobId), 2500);
                    } else {
                        this.showSyncProgress = false;
                        this.showSyncError = true;
                        this.syncRetryCount = 0;
                    }
                },
            );
    }

    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected === numRows;
    }

    isSyncFromPanoramaButtonActive(): boolean {
        return (
            this.selection.selected.length > 0 &&
            this.selection.selected.every(
                (device) => device.device_type === "Panorama",
            )
        );
    }

    masterToggle() {
        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            this.dataSource.data.forEach((row) => this.selection.select(row));
        }
    }

    navigateToCreateInventory(): void {
        this.router.navigate(["/inventory/create"]);
    }

    navigateToSyncInventory(): void {
        this.router.navigate(["/inventory/sync"]);
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory List";
        this.getDevices();
        this.getPanoramaDevices();
        this.getProfiles();
    }

    onDeleteSelectedClick() {
        const selectedItems = this.selection.selected;
        const dialogRef = this.dialog.open(InventoryDeleteDialogComponent, {
            width: "480px",
            data: {
                title: "Confirm Delete",
                // eslint-disable-next-line max-len
                message: `Are you sure you want to delete ${selectedItems.length} selected inventory item(s)?`,
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result: boolean) => {
                if (result) {
                    const deleteRequests = selectedItems.map((item) =>
                        this.inventoryService.deleteDevice(item.uuid),
                    );
                    forkJoin(deleteRequests).subscribe(
                        () => {
                            this.selection.clear();
                            this.getDevices();
                        },
                        (error) => {
                            console.error(
                                "Error deleting inventory items:",
                                error,
                            );
                            this.snackBar.open(
                                "Failed to delete selected inventory items. Please try again.",
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                        },
                    );
                }
            });
    }

    onEditClick(item: Device): void {
        this.router.navigate(["/inventory", item.uuid]);
    }

    onRefreshSelectedClick() {
        const selectedItems = this.selection.selected;
        const dialogRef = this.dialog.open(ProfileDialogComponent, {
            width: "480px",
            data: { message: "Select a profile to refresh device details" },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((selectedProfileUuid) => {
                if (selectedProfileUuid && selectedItems.length > 0) {
                    const author = localStorage.getItem("author");
                    const refreshRequests = selectedItems.map((item) => {
                        const refreshForm = {
                            author: author ? parseInt(author, 10) : 0,
                            device: item.uuid,
                            profile: selectedProfileUuid,
                        };
                        return this.inventoryService.refreshDevice(refreshForm);
                    });

                    this.showRefreshProgress = true;
                    this.showRefreshError = false;
                    this.refreshJobsCompleted = 0;
                    this.totalRefreshJobs = selectedItems.length;

                    forkJoin(refreshRequests)
                        .pipe(takeUntil(this.destroy$))
                        .subscribe(
                            (jobIds) => {
                                jobIds.forEach((jobId) => {
                                    if (jobId) {
                                        this.getJobStatus(jobId);
                                    }
                                });
                            },
                            (error) => {
                                console.error(
                                    "Error refreshing device details:",
                                    error,
                                );
                                this.showRefreshProgress = false;
                                this.showRefreshError = true;
                                this.snackBar.open(
                                    "Failed to refresh device details. Please try again.",
                                    "Close",
                                    {
                                        duration: 3000,
                                    },
                                );
                            },
                        );
                }
            });
    }

    onSyncFromPanoramaClick(): void {
        const selectedPanoramaDevices = this.selection.selected.filter(
            (device) => device.device_type === "Panorama",
        );

        if (selectedPanoramaDevices.length === 0) {
            return;
        }

        const dialogRef = this.dialog.open(ProfileDialogComponent, {
            width: "520px",
            data: {
                message: "Select a profile to sync inventory from Panorama",
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((selectedProfileUuid) => {
                if (selectedProfileUuid) {
                    const author = localStorage.getItem("author");
                    const syncRequests = selectedPanoramaDevices.map(
                        (device) => {
                            const syncForm: InventorySyncForm = {
                                author: author ? parseInt(author, 10) : 0,
                                panorama_device: device.uuid,
                                profile: selectedProfileUuid,
                            };
                            return this.inventoryService.syncInventory(
                                syncForm,
                            );
                        },
                    );

                    this.showSyncProgress = true;
                    this.showSyncError = false;
                    this.syncJobsCompleted = 0;
                    this.totalSyncJobs = selectedPanoramaDevices.length;

                    forkJoin(syncRequests)
                        .pipe(takeUntil(this.destroy$))
                        .subscribe(
                            (jobIds) => {
                                jobIds.forEach((jobId) => {
                                    if (jobId) {
                                        this.getSyncJobStatus(jobId);
                                    }
                                });
                            },
                            (error) => {
                                console.error(
                                    "Error syncing inventory:",
                                    error,
                                );
                                this.showSyncProgress = false;
                                this.showSyncError = true;
                            },
                        );
                }
            });
    }

    toggleAllRows() {
        if (this.isAllSelected()) {
            this.selection.clear();
            return;
        }

        this.selection.select(...this.dataSource.data);
    }
}
