// src/app/pages/inventory-create/inventory-create.ts

import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { Component } from "@angular/core";
import { InventoryService } from "../../shared/services/inventory.service";
import { MatButtonModule } from "@angular/material/button";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { Router } from "@angular/router";

@Component({
    selector: "app-inventory-create",
    templateUrl: "./inventory-create.html",
    styleUrls: ["./inventory-create.scss"],
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
    ],
})
export class InventoryCreateComponent {
    inventoryForm: FormGroup;

    constructor(
        private formBuilder: FormBuilder,
        private inventoryService: InventoryService,
        private router: Router,
    ) {
        this.inventoryForm = this.formBuilder.group({
            name: ["", Validators.required],
            description: [""],
        });
    }

    createInventoryItem(): void {
        if (this.inventoryForm.valid) {
            this.inventoryService
                .createInventoryItem(this.inventoryForm.value)
                .subscribe(
                    () => {
                        this.router.navigate(["/inventory"]);
                    },
                    (error) => {
                        console.error("Error creating inventory item:", error);
                    },
                );
        }
    }
}
