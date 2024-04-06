/* eslint-disable @typescript-eslint/naming-convention */
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
import { Device } from "../../shared/interfaces/device.interface";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryPageHeader } from "../inventory-page-header/inventory-page-header";
import { InventoryService } from "../../shared/services/inventory.service";
import { InventorySyncForm } from "../../shared/interfaces/inventory-sync-form.interface";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { Observable } from "rxjs";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileService } from "../../shared/services/profile.service";
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
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
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
    panoramaDevices: Device[] = [];
    panoramaDevices$: Observable<Device[]> = new Observable<Device[]>();
    profiles$: Observable<Profile[]> = new Observable<Profile[]>();
    showSyncProgress: boolean = false;
    showSyncError: boolean = false;
    jobId: string | null = null;

    constructor(
        private formBuilder: FormBuilder,
        private router: Router,
        private inventoryService: InventoryService,
        private profileService: ProfileService,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.syncInventoryForm = this.formBuilder.group({
            panorama_device: ["", Validators.required],
            profile: ["", Validators.required],
        });
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Inventory Sync";
        this.panoramaDevices$ = this.inventoryService.getPanoramaDevices();
        this.profiles$ = this.profileService.getProfiles();
    }

    onCancel(): void {
        this.syncInventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }

    syncInventory(): void {
        if (this.syncInventoryForm.valid) {
            const author = localStorage.getItem("author");
            const syncForm: InventorySyncForm = {
                author: author ? parseInt(author, 10) : 0,
                panorama_device:
                    this.syncInventoryForm.get("panorama_device")?.value,
                profile: this.syncInventoryForm.get("profile")?.value,
            };
            this.showSyncProgress = true;
            this.showSyncError = false;

            // Insert a one second delay to allow the API to initialize the job
            setTimeout(() => {
                this.inventoryService.syncInventory(syncForm).subscribe(
                    (jobId) => {
                        this.jobId = jobId;
                        this.checkJobStatus();
                    },
                    (error) => {
                        console.error("Error syncing inventory:", error);
                        this.showSyncProgress = false;
                        this.showSyncError = true;
                    },
                );
            }, 1000);
        }
    }

    checkJobStatus(): void {
        if (this.jobId) {
            this.inventoryService.getJobStatus(this.jobId).subscribe(
                (response) => {
                    if (response.status === "completed") {
                        this.showSyncProgress = false;
                        this.router.navigate(["/inventory"]);
                    } else {
                        setTimeout(() => this.checkJobStatus(), 2000);
                    }
                },
                (error) => {
                    console.error("Error checking job status:", error);
                    this.showSyncProgress = false;
                    this.showSyncError = true;
                },
            );
        }
    }
}
