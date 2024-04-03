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
import { Footer } from "src/app/shared/footer/footer";
import { InventoryItem } from "../../shared/interfaces/inventory-item.interface";
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
    inventoryItems: InventoryItem[] = [];
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
    dataSource: MatTableDataSource<InventoryItem> =
        new MatTableDataSource<InventoryItem>([]);

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private dialog: MatDialog,
        private inventoryService: InventoryService,
        private router: Router,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    /**
     * Initializes the component.
     * Sets the page title to "Inventory List" and retrieves the inventory items.
     */
    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory List";
        this.getInventoryItems();
    }

    /**
     * Lifecycle hook that is called after Angular has fully initialized the component's view.
     * It is called after the view has been rendered and all child views have been initialized.
     * This hook performs additional initialization tasks that require the view to be rendered.
     */
    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    /**
     * Retrieves items from the inventory service and sets up the data source for the table.
     */
    getInventoryItems(): void {
        this.inventoryService.getInventoryItems().subscribe(
            (items) => {
                this.inventoryItems = items;
                this.dataSource = new MatTableDataSource(this.inventoryItems);
                this.dataSource.sort = this.sort;
            },
            (error) => {
                console.error("Error fetching inventory items:", error);
            },
        );
    }

    /**
     * Navigates to the inventory page for editing the specified item.
     * @param item - The item to be edited. It can be an InventoryItem object.
     */
    onEditClick(item: InventoryItem): void {
        this.router.navigate(["/inventory", item.uuid]);
    }

    /**
     * Announces the change in sorting state.
     *
     * @param sortState - The new sorting state.
     */
    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }

    navigateToCreateInventory(): void {
        this.router.navigate(["/inventory/create"]);
    }

    /**
     * Opens the delete dialog when the delete button is clicked.
     * @param item - The item to be deleted. It can be an InventoryItem object.
     */
    onDeleteClick(item: InventoryItem): void {
        const dialogRef = this.dialog.open(DeleteDialogComponent, {
            width: "300px",
            data: {
                title: "Confirm Delete",
                message: "Are you sure you want to delete this inventory item?",
            },
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if (result) {
                this.inventoryService.deleteInventoryItem(item.uuid).subscribe(
                    () => {
                        this.getInventoryItems(); // Refresh the inventory list after deletion
                    },
                    (error) => {
                        console.error("Error deleting inventory item:", error);
                    },
                );
            }
        });
    }
}
