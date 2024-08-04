/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
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
import { forkJoin, Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { NgxChartsModule } from "@swimlane/ngx-charts";

import { ComponentPageTitle } from "../page-title/page-title";
import { CookieService } from "ngx-cookie-service";
import { Device } from "../../shared/interfaces/device.interface";
import { DeviceSyncForm } from "../../shared/interfaces/device-sync-form.interface";
import { InventoryDeleteDialogComponent } from "../inventory-delete-dialog/inventory-delete-dialog";
import { InventoryService } from "../../shared/services/inventory.service";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileDialogComponent } from "../profile-select-dialog/profile-select-dialog.component";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { SelectionModel } from "@angular/cdk/collections";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";

@Component({
    selector: "app-inventory-list",
    templateUrl: "./inventory-list.html",
    styleUrls: ["./inventory-list.scss"],
    standalone: true,
    imports: [
        MatCheckboxModule,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
        MatDialogModule,
        MatListModule,
        NgxChartsModule,
        PageHeaderComponent,
    ],
})

/**
 * Component for displaying the inventory list.
 */
export class InventoryList implements OnInit, AfterViewInit, OnDestroy {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;

    // Component page details
    pageTitle = "Inventory List";
    pageDescription = "Manage your device inventory";
    breadcrumbs = [
        { label: "Home", url: "/" },
        { label: "Inventory", url: "/inventory" },
    ];

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
    panoramaDevices: Device[] = [];
    profiles: Profile[] = [];
    refreshJobsCompleted: number = 0;
    selection = new SelectionModel<Device>(true, []);
    showRefreshError: boolean = false;
    showRefreshProgress: boolean = false;
    showSyncError: boolean = false;
    showSyncProgress: boolean = false;
    syncJobsCompleted: number = 0;
    totalRefreshJobs: number = 0;
    totalSyncJobs: number = 0;
    private syncRetryCount = 0;
    private retryCount = 0;
    private destroy$ = new Subject<void>();

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private cookieService: CookieService,
        private dialog: MatDialog,
        private inventoryService: InventoryService,
        private profileService: ProfileService,
        private router: Router,
        private snackBar: MatSnackBar,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    /**
     * Announces the change in sort state.
     *
     * @param sortState - The new sort state to be announced.
     * @return
     */
    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }

    /**
     * Returns the label text for a checkbox based on the provided row.
     *
     * @param [row] - The device row object. It is optional and can be omitted.
     * @returns The label text for the checkbox.
     */
    checkboxLabel(row?: Device): string {
        if (!row) {
            return `${this.isAllSelected() ? "select" : "deselect"} all`;
        }
        return `${this.selection.isSelected(row) ? "deselect" : "select"} row ${row.hostname}`;
    }

    /**
     * Retrieves devices from the inventory service and updates the component's inventoryItems and dataSource properties.
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

    /**
     * Retrieves the status of a job.
     *
     * @param jobId - The ID of the job to get status for.
     * @return
     */
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

    /**
     * Retrieves the Panorama devices from the inventory service.
     *
     * @returns
     *
     * @example
     * // Example usage:
     * getPanoramaDevices();
     */
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

    /**
     * Retrieves profiles from the profile service and assigns them to the local profiles variable.
     *
     * @return
     */
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

    /**
     * Retrieves the synchronization job status for a given job ID.
     *
     * @param jobId - The ID of the synchronization job.
     * @return
     */
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
                        setTimeout(() => this.getSyncJobStatus(jobId), 2500);
                    } else {
                        this.showSyncProgress = false;
                        this.showSyncError = true;
                        this.syncRetryCount = 0;
                    }
                },
            );
    }

    /**
     * Checks if all items are selected.
     * @returns - True if all items are selected, false otherwise.
     */
    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected === numRows;
    }

    isAnyItemSelected(): boolean {
        return this.selection.selected.length > 0;
    }

    isSyncFromPanoramaButtonActive(): boolean {
        return (
            this.selection.selected.length > 0 &&
            this.selection.selected.every(
                (device) => device.device_type === "Panorama",
            )
        );
    }

    /**
     * Toggles the selection of all items in the data source.
     * If all items are already selected, clears the selection.
     * If not all items are selected, selects all items.
     * Deselects the header checkbox.
     *
     * @return void
     */
    masterToggle() {
        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            this.dataSource.data.forEach((row) => this.selection.select(row));
        }
        // Deselect the header checkbox
        const headerCheckbox = document.querySelector(
            "th.mat-column-select .mat-checkbox-input",
        ) as HTMLInputElement;
        if (headerCheckbox) {
            headerCheckbox.checked = false;
        }
    }

    /**
     * Navigates to the create inventory page.
     *
     * @return
     */
    navigateToCreateInventory(): void {
        this.router.navigate(["/inventory/create"]);
    }

    /**
     * This method is called after the view has been initialized.
     * It sets the sort property of the dataSource to the specified sort object.
     *
     * @return - No return value
     */
    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
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

    /**
     * Initializes the component.
     * Sets the page title, and fetches devices, panorama devices, and profiles.
     *
     * @returns
     */
    ngOnInit(): void {
        this._componentPageTitle.title = this.pageTitle;
        this.getDevices();
        this.getPanoramaDevices();
        this.getProfiles();

        // Add this line to update the data source when selection changes
        this.selection.changed.subscribe(() => {
            this.dataSource._updateChangeSubscription();
        });
    }

    /**
     * Executes the logic for deleting selected inventory items.
     *
     * @returns
     */
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

    /**
     * Handles the event when an edit button is clicked.
     *
     * @param item - The device associated with the clicked edit button.
     *
     * @return
     */
    onEditClick(item: Device): void {
        this.router.navigate(["/inventory", item.uuid]);
    }

    /**
     * Executes the onRefreshSelectedClick action.
     *
     * @return
     */
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
                    const author = this.cookieService.get("author");
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

    /**
     * Synchronizes inventory from selected Panorama devices.
     * Opens a dialog to select a profile to sync the inventory from Panorama.
     *
     * @returns
     */
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
                    const author = this.cookieService.get("author");
                    const syncRequests = selectedPanoramaDevices.map(
                        (device) => {
                            const syncForm: DeviceSyncForm = {
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
}
