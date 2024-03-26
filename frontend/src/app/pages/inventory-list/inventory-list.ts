import {
    AfterViewInit,
    Component,
    HostBinding,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";

import { Firewall } from "../../shared/interfaces/firewall.interface";
import { InventoryService } from "../../shared/services/inventory.service";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { NgFor } from "@angular/common";
import { Panorama } from "../../shared/interfaces/panorama.interface";
import { Router } from "@angular/router";

@Component({
    selector: "app-inventory-list",
    templateUrl: "./inventory-list.html",
    styleUrls: ["./inventory-list.scss"],
    standalone: true,
    imports: [NgFor, MatTableModule, MatSortModule],
})
export class InventoryList implements OnInit, AfterViewInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryItems: (Firewall | Panorama)[] = [];
    displayedColumns: string[] = [
        "hostname",
        "ipAddress",
        "platform",
        "inventoryType",
        "notes",
    ];
    dataSource: MatTableDataSource<Firewall | Panorama> =
        new MatTableDataSource<Firewall | Panorama>([]);

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private inventoryService: InventoryService,
        private router: Router,
        private _liveAnnouncer: LiveAnnouncer,
    ) {}

    ngOnInit(): void {
        this.getInventoryItems();
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

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

    onRowClick(item: Firewall | Panorama): void {
        this.router.navigate(["/inventory", item.uuid]);
    }

    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }
}
