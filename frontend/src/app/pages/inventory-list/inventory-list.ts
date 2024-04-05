// src/app/pages/inventory-list/inventory-list.ts

import {
    AfterViewInit,
    Component,
    HostBinding,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";

import { ComponentPageTitle } from "../page-title/page-title";
import { DeleteDialogComponent } from "../confirmation-dialog/delete-dialog";
import { Device } from "../../shared/interfaces/device.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryService } from "../../shared/services/inventory.service";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { NgFor } from "@angular/common";
import { Router } from "@angular/router";

@Component({
    selector: "app-inventory-list",
    templateUrl: "./inventory-list.html",
    styleUrls: ["./inventory-list.scss"],
    standalone: true,
    imports: [
        NgFor,
        InventoryPageHeader,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
        Footer,
    ],
})
/**
 * Component for displaying the inventory list.
 */
export class InventoryList implements OnInit, AfterViewInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryItems: Device[] = [];
    displayedColumns: string[] = [
        "hostname",
        "notes",
        "ipv4_address",
        "ipv6_address",
        "device_type",
        "platform_name",
        "edit",
        "delete",
    ];
    dataSource: MatTableDataSource<Device> = new MatTableDataSource<Device>([]);

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private dialog: MatDialog,
        private inventoryService: InventoryService,
        private router: Router,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory List";
        this.getDevices();
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }

    getDevices(): void {
        this.inventoryService.getDevices().subscribe(
            (items) => {
                this.inventoryItems = items;
                this.inventoryItems.sort((a, b) =>
                    a.hostname.localeCompare(b.hostname),
                );
                this.dataSource = new MatTableDataSource(this.inventoryItems);
                this.dataSource.sort = this.sort;
            },
            (error) => {
                console.error("Error fetching inventory items:", error);
            },
        );
    }

    navigateToCreateInventory(): void {
        this.router.navigate(["/inventory/create"]);
    }

    navigateToSyncInventory(): void {
        this.router.navigate(["/inventory/sync"]);
    }

    onDeleteClick(item: Device): void {
        const dialogRef = this.dialog.open(DeleteDialogComponent, {
            width: "300px",
            data: {
                title: "Confirm Delete",
                message: "Are you sure you want to delete this inventory item?",
            },
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if (result) {
                this.inventoryService.deleteDevice(item.uuid).subscribe(
                    () => {
                        this.getDevices(); // Refresh the inventory list after deletion
                    },
                    (error) => {
                        console.error("Error deleting inventory item:", error);
                    },
                );
            }
        });
    }

    onEditClick(item: Device): void {
        this.router.navigate(["/inventory", item.uuid]);
    }
}
