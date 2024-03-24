// src/app/pages/inventory-list/inventory-list.ts

import { Component, HostBinding, OnInit } from "@angular/core";

import { Firewall } from "../../shared/interfaces/firewall.interface";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatCardModule } from "@angular/material/card";
import { NgFor } from "@angular/common";
import { Panorama } from "../../shared/interfaces/panorama.interface";
import { RouterLink } from "@angular/router";

@Component({
    selector: "app-inventory-list",
    templateUrl: "./inventory-list.html",
    styleUrls: ["./inventory-list.scss"],
    standalone: true,
    imports: [NgFor, RouterLink, MatCardModule],
})
export class InventoryList implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    inventoryItems: (Firewall | Panorama)[] = [];

    constructor(private inventoryService: InventoryService) {}

    ngOnInit(): void {
        this.getInventoryItems();
    }

    getInventoryItems(): void {
        this.inventoryService.fetchInventoryData().subscribe(
            (items) => {
                this.inventoryItems = items;
            },
            (error) => {
                console.error("Error fetching inventory items:", error);
            },
        );
    }
}
