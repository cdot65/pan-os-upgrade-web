/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/inventory-list/inventory-list.component.ts

import {
    AfterViewInit,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortHeader, Sort } from "@angular/material/sort";
import {
    MatCell,
    MatCellDef,
    MatColumnDef,
    MatHeaderCell,
    MatHeaderCellDef,
    MatHeaderRow,
    MatHeaderRowDef,
    MatRow,
    MatRowDef,
    MatTable,
    MatTableDataSource,
} from "@angular/material/table";
import { SelectionModel } from "@angular/cdk/collections";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { INVENTORY_LIST_CONFIG } from "./inventory-list.config";
import { InventoryListFacade } from "./inventory-list.facade";
import { InventoryListProcessorService } from "./inventory-list.processor.service";
import { Device } from "../../shared/interfaces/device.interface";
import { InventoryDeleteDialogComponent } from "../inventory-delete-dialog/inventory-delete-dialog";
import { ProfileDialogComponent } from "../profile-select-dialog/profile-select-dialog.component";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { MatIcon } from "@angular/material/icon";
import { MatButton, MatIconButton } from "@angular/material/button";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatCheckbox } from "@angular/material/checkbox";
import { CookieService } from "ngx-cookie-service";

@Component({
    selector: "app-inventory-list",
    templateUrl: "./inventory-list.component.html",
    styleUrls: ["./inventory-list.component.scss"],
    providers: [InventoryListFacade],
    standalone: true,
    imports: [
        PageHeaderComponent,
        MatIcon,
        MatButton,
        MatTable,
        MatSort,
        MatColumnDef,
        MatHeaderCell,
        MatCheckbox,
        MatCell,
        MatCellDef,
        MatHeaderCellDef,
        MatSortHeader,
        MatHeaderRow,
        MatHeaderRowDef,
        MatRowDef,
        MatRow,
        MatIconButton,
    ],
})
export class InventoryListComponent
    implements OnInit, OnDestroy, AfterViewInit {
    config = INVENTORY_LIST_CONFIG;
    dataSource = new MatTableDataSource<Device>([]);
    selection = new SelectionModel<Device>(true, []);

    @ViewChild(MatSort) sort!: MatSort;

    private destroy$ = new Subject<void>();

    constructor(
        private facade: InventoryListFacade,
        protected processor: InventoryListProcessorService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private router: Router,
        private _liveAnnouncer: LiveAnnouncer,
        private cookieService: CookieService,
    ) {}

    ngOnInit(): void {
        this.loadData();
    }

    ngAfterViewInit(): void {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadData(): void {
        this.facade.loadInventoryItems();
        this.facade
            .getInventoryItems()
            .pipe(takeUntil(this.destroy$))
            .subscribe((items) => {
                this.dataSource.data = items;
            });
    }

    isAllSelected(): boolean {
        return this.processor.isAllSelected(
            this.selection.selected,
            this.dataSource.data,
        );
    }

    masterToggle(): void {
        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            this.dataSource.data.forEach((row) => this.selection.select(row));
        }
    }

    checkboxLabel(row?: Device): string {
        return this.processor.checkboxLabel(this.isAllSelected(), row);
    }

    async announceSortChange(sortState: Sort): Promise<void> {
        try {
            if (sortState.direction) {
                await this._liveAnnouncer.announce(
                    `Sorted ${sortState.direction}ending`,
                );
            } else {
                await this._liveAnnouncer.announce("Sorting cleared");
            }
        } catch (error) {
            console.error("Error announcing sort change:", error);
        }
    }

    onDeleteSelectedClick(): void {
        const dialogRef = this.dialog.open(InventoryDeleteDialogComponent, {
            width: this.config.deleteDialogWidth,
            data: { count: this.selection.selected.length },
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result) {
                const deviceUuids = this.selection.selected.map(
                    (device) => device.uuid,
                );
                this.facade.deleteDevices(deviceUuids).subscribe(
                    () => {
                        this.loadData();
                        this.selection.clear();
                        this.snackBar.open(
                            "Devices deleted successfully",
                            "Close",
                            { duration: this.config.snackBarDuration },
                        );
                    },
                    (error) => {
                        console.error("Error deleting devices:", error);
                        this.snackBar.open(
                            "Failed to delete devices",
                            "Close",
                            { duration: this.config.snackBarDuration },
                        );
                    },
                );
            }
        });
    }

    onRefreshSelectedClick(): void {
        const dialogRef = this.dialog.open(ProfileDialogComponent, {
            width: this.config.refreshDialogWidth,
            data: { message: "Select a profile to refresh device details" },
        });

        dialogRef.afterClosed().subscribe((selectedProfileUuid) => {
            if (selectedProfileUuid) {
                const refreshForms = this.selection.selected.map((device) => ({
                    device: device.uuid,
                    profile: selectedProfileUuid,
                }));

                this.facade.refreshDevices(refreshForms).subscribe(
                    (jobIds) => {
                        jobIds.forEach((jobId) => this.pollJobStatus(jobId));
                    },
                    (error) => {
                        console.error("Error refreshing devices:", error);
                        this.snackBar.open(
                            "Failed to refresh devices",
                            "Close",
                            { duration: this.config.snackBarDuration },
                        );
                    },
                );
            }
        });
    }

    onSyncFromPanoramaClick(): void {
        const dialogRef = this.dialog.open(ProfileDialogComponent, {
            width: this.config.syncDialogWidth,
            data: {
                message: "Select a profile to sync inventory from Panorama",
            },
        });

        dialogRef.afterClosed().subscribe((selectedProfileUuid) => {
            if (selectedProfileUuid) {
                const author = this.cookieService.get("author");
                const authorId = author ? parseInt(author, 10) : 0;

                const syncForms = this.selection.selected
                    .filter((device) => device.device_type === "Panorama")
                    .map((device) => ({
                        author: authorId,
                        panorama_device: device.uuid,
                        profile: selectedProfileUuid,
                    }));

                this.facade.syncInventory(syncForms).subscribe(
                    (jobIds) => {
                        jobIds.forEach((jobId) => this.pollJobStatus(jobId));
                    },
                    (error) => {
                        console.error("Error syncing inventory:", error);
                        this.snackBar.open(
                            "Failed to sync inventory",
                            "Close",
                            { duration: this.config.snackBarDuration },
                        );
                    },
                );
            }
        });
    }

    pollJobStatus(jobId: string): void {
        this.facade.getJobStatus(jobId).subscribe(
            (response) => {
                if (response.status === "completed") {
                    this.loadData();
                } else {
                    setTimeout(
                        () => this.pollJobStatus(jobId),
                        this.config.retryDelay,
                    );
                }
            },
            (error) => {
                console.error("Error checking job status:", error);
            },
        );
    }

    async onEditClick(item: Device): Promise<void> {
        try {
            await this.router.navigate(["/inventory", item.uuid]);
        } catch (error) {
            console.error("Navigation error:", error);
        }
    }

    navigateToCreateInventory(): void {
        this.router.navigate(["/inventory/create"]).catch((error) => {
            console.error("Navigation error:", error);
        });
    }
}
