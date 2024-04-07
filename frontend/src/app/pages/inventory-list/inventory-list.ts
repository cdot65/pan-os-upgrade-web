// src/app/pages/inventory-list/inventory-list.ts

import {
    AfterViewInit,
    Component,
    HostBinding,
    OnDestroy,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { Subject, forkJoin } from "rxjs";

import { ComponentPageTitle } from "../page-title/page-title";
import { DeleteDialogComponent } from "../confirmation-dialog/delete-dialog";
import { Device } from "../../shared/interfaces/device.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryService } from "../../shared/services/inventory.service";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
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
        "notes",
        "ipv4_address",
        "ipv6_address",
        "device_type",
        "platform_name",
        "edit",
    ];
    selection = new SelectionModel<Device>(true, []);
    dataSource: MatTableDataSource<Device> = new MatTableDataSource<Device>([]);
    private destroy$ = new Subject<void>();

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private dialog: MatDialog,
        private inventoryService: InventoryService,
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

    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected === numRows;
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
    }

    onDeleteClick(item: Device): void {
        const dialogRef = this.dialog.open(DeleteDialogComponent, {
            width: "300px",
            data: {
                title: "Confirm Delete",
                message: "Are you sure you want to delete this inventory item?",
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result: boolean) => {
                if (result) {
                    this.inventoryService.deleteDevice(item.uuid).subscribe(
                        () => {
                            this.getDevices(); // Refresh the inventory list after deletion
                        },
                        (error) => {
                            console.error(
                                "Error deleting inventory item:",
                                error,
                            );
                            this.snackBar.open(
                                "Failed to delete inventory item. Please try again.",
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

    onDeleteSelectedClick() {
        const selectedItems = this.selection.selected;
        const dialogRef = this.dialog.open(DeleteDialogComponent, {
            width: "300px",
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

    toggleAllRows() {
        if (this.isAllSelected()) {
            this.selection.clear();
            return;
        }

        this.selection.select(...this.dataSource.data);
    }
}
