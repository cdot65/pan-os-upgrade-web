import {
    AfterViewInit,
    Component,
    HostBinding,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";

import { ComponentPageHeader } from "../component-page-header/component-page-header";
import { ComponentPageTitle } from "../page-title/page-title";
import { Firewall } from "../../shared/interfaces/firewall.interface";
import { InventoryService } from "../../shared/services/inventory.service";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { NgFor } from "@angular/common";
import { Panorama } from "../../shared/interfaces/panorama.interface";
import { Router } from "@angular/router";

@Component({
    selector: "app-inventory-list",
    templateUrl: "./inventory-list.html",
    styleUrls: ["./inventory-list.scss"],
    standalone: true,
    imports: [
        NgFor,
        ComponentPageHeader,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
    ],
})
/**
 * Component for displaying the inventory list.
 */
export class InventoryList implements OnInit, AfterViewInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryItems: (Firewall | Panorama)[] = [];
    displayedColumns: string[] = [
        "hostname",
        "ipv4Address",
        "ipv6Address",
        "platform",
        "inventoryType",
        "notes",
        "edit",
    ];
    dataSource: MatTableDataSource<Firewall | Panorama> =
        new MatTableDataSource<Firewall | Panorama>([]);

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
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
        this.inventoryService.fetchInventoryData().subscribe(
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
     * @param item - The item to be edited. It can be either a Firewall or Panorama object.
     */
    onEditClick(item: Firewall | Panorama): void {
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
}
