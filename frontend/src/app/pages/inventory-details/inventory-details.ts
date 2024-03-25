// src/app/pages/inventory-details/inventory-details.ts

import { ActivatedRoute, Router } from "@angular/router";
import { Component, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { Firewall } from "../../shared/interfaces/firewall.interface";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { Panorama } from "../../shared/interfaces/panorama.interface";

@Component({
    selector: "app-inventory-details",
    templateUrl: "./inventory-details.html",
    styleUrls: ["./inventory-details.scss"],
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
    ],
})
export class InventoryDetailsComponent implements OnInit {
    inventoryItem: Firewall | Panorama | undefined;
    inventoryForm: FormGroup;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private inventoryService: InventoryService,
        private formBuilder: FormBuilder,
    ) {
        this.inventoryForm = this.formBuilder.group({
            name: ["", Validators.required],
            description: [""],
        });
    }

    ngOnInit(): void {
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.getInventoryItem(itemId);
        }
    }

    getInventoryItem(itemId: string): void {
        this.inventoryService.getInventoryItem(itemId).subscribe(
            (item: Firewall | Panorama) => {
                this.inventoryItem = item;
                this.inventoryForm.patchValue(item);
            },
            (error: any) => {
                console.error("Error fetching inventory item:", error);
            },
        );
    }

    updateInventoryItem(): void {
        if (this.inventoryItem && this.inventoryForm.valid) {
            const updatedItem = {
                ...this.inventoryItem,
                ...this.inventoryForm.value,
            };
            this.inventoryService
                .updateInventoryItem(updatedItem, this.inventoryItem.uuid)
                .subscribe(
                    () => {
                        this.router.navigate(["/inventory"]);
                    },
                    (error) => {
                        console.error("Error updating inventory item:", error);
                    },
                );
        }
    }

    deleteInventoryItem(): void {
        if (this.inventoryItem) {
            this.inventoryService
                .deleteInventoryItem(this.inventoryItem.uuid)
                .subscribe(
                    () => {
                        this.router.navigate(["/inventory"]);
                    },
                    (error) => {
                        console.error("Error deleting inventory item:", error);
                    },
                );
        }
    }
}