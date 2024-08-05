// src/app/pages/inventory-create/inventory-create.ts

import { Component, HostBinding, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { ComponentPageTitle } from "../page-title/page-title";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { InventoryCreateFacade } from "./inventory-create.facade";

@Component({
    selector: "app-inventory-create",
    templateUrl: "./inventory-create.html",
    styleUrls: ["./inventory-create.scss"],
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        PageHeaderComponent,
    ],
    providers: [InventoryCreateFacade],
})
export class InventoryCreateComponent implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    config = this.facade.getConfig();
    createInventoryForm = this.facade.createInventoryForm;
    devices$ = this.facade.getDevices$();
    firewallPlatforms$ = this.facade.getFirewallPlatforms$();
    panoramaPlatforms$ = this.facade.getPanoramaPlatforms$();

    constructor(
        private facade: InventoryCreateFacade,
        private router: Router,
        private snackBar: MatSnackBar,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    ngOnInit(): void {
        this._componentPageTitle.title = this.config.pageTitle;
        this.facade.getDevices();
        this.facade.getFirewallPlatforms();
    }

    createDevice(): void {
        this.facade.createDevice().subscribe(
            () => {
                this.router.navigate(["/inventory"]);
            },
            (error) => {
                console.error("Error creating inventory item:", error);
                this.snackBar.open(
                    "Failed to create inventory item. Please try again.",
                    "Close",
                    {
                        duration: 3000,
                    },
                );
            },
        );
    }

    onCancel(): void {
        this.facade.onCancel();
    }
}
