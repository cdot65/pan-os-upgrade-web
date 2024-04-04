// src/app/pages/inventory-sync/inventory-sync.ts

import { AsyncPipe, NgForOf } from "@angular/common";
import { Component, HostBinding, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryItem } from "../../shared/interfaces/inventory-item.interface";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { Observable } from "rxjs";
import { Router } from "@angular/router";

@Component({
    selector: "app-inventory-sync",
    templateUrl: "./inventory-sync.html",
    styleUrls: ["./inventory-sync.scss"],
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        InventoryPageHeader,
        Footer,
        AsyncPipe,
        NgForOf,
    ],
})
export class InventorySyncComponent implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    syncInventoryForm: FormGroup;
    panoramaDevices$: Observable<InventoryItem[]> = new Observable<
        InventoryItem[]
    >();

    constructor(
        private formBuilder: FormBuilder,
        private router: Router,
        private inventoryService: InventoryService,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.syncInventoryForm = this.formBuilder.group({
            panoramaDevice: ["", Validators.required],
            panoramaUsername: ["", Validators.required],
            panoramaPassword: ["", Validators.required],
        });
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Sync Inventory from Panorama";
        this.panoramaDevices$ = this.inventoryService.getPanoramaDevices();
    }

    onCancel(): void {
        this.syncInventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }

    syncInventory(): void {
        if (this.syncInventoryForm.valid) {
            // TODO: Implement the inventory sync logic
            console.log(
                "Syncing inventory from Panorama:",
                this.syncInventoryForm.value,
            );
        }
    }
}
