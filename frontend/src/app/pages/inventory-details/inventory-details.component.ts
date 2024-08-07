/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/inventory-details/inventory-details.component.ts

import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { CookieService } from "ngx-cookie-service";
import { ComponentPageTitle } from "../page-title/page-title";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { ProfileDialogComponent } from "../profile-select-dialog/profile-select-dialog.component";
import { InventoryDetailsFacade } from "./inventory-details.facade";
import { switchMap, take, takeUntil } from "rxjs/operators";
import { EMPTY, Subject } from "rxjs";

@Component({
    selector: "app-inventory-details",
    templateUrl: "./inventory-details.component.html",
    styleUrls: ["./inventory-details.component.scss"],
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        PageHeaderComponent,
    ],
    providers: [InventoryDetailsFacade],
})
export class InventoryDetailsComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    config = this.facade.getConfig();
    updateInventoryForm = this.facade.updateInventoryForm;
    devices$ = this.facade.getDevices$();
    firewallPlatforms$ = this.facade.getFirewallPlatforms$();
    panoramaPlatforms$ = this.facade.getPanoramaPlatforms$();
    panoramas$ = this.facade.getPanoramas$();
    inventoryItem$ = this.facade.getInventoryItem$();

    jobId: string | null = null;
    refreshJobCompleted = false;
    showRefreshError = false;
    showRefreshProgress = false;

    private destroy$ = new Subject<void>();

    constructor(
        private facade: InventoryDetailsFacade,
        private route: ActivatedRoute,
        private router: Router,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private cookieService: CookieService,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    ngOnInit(): void {
        this._componentPageTitle.title = this.config.pageTitle;
        this.facade.getDevices();
        this.facade.getPanoramaAppliances();
        const itemId = this.route.snapshot.paramMap.get("id");
        if (itemId) {
            this.facade.getDevice(itemId);
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    onCancel(): void {
        this.updateInventoryForm.reset();
        this.router.navigate(["/inventory"]);
    }

    refreshDeviceDetails(): void {
        const dialogRef = this.dialog.open(ProfileDialogComponent, {
            width: "400px",
            data: { message: "Select a profile to refresh device details" },
        });

        dialogRef.afterClosed().subscribe((selectedProfileUuid) => {
            if (selectedProfileUuid) {
                const author = this.cookieService.get("author");
                this.inventoryItem$
                    .pipe(
                        take(1),
                        switchMap((item) => {
                            if (item) {
                                const refreshForm = {
                                    author: author ? parseInt(author, 10) : 0,
                                    device: item.uuid,
                                    profile: selectedProfileUuid,
                                };
                                this.showRefreshProgress = true;
                                this.showRefreshError = false;
                                return this.facade.refreshDevice(refreshForm);
                            }
                            return EMPTY;
                        }),
                        takeUntil(this.destroy$),
                    )
                    .subscribe(
                        (completed) => {
                            if (completed) {
                                this.showRefreshProgress = false;
                                this.snackBar.open(
                                    "Device details refreshed successfully",
                                    "Close",
                                    { duration: 3000 },
                                );
                            }
                        },
                        (error) => {
                            console.error(
                                "Error refreshing device details:",
                                error,
                            );
                            this.showRefreshProgress = false;
                            this.showRefreshError = true;
                            this.snackBar.open(
                                "Failed to refresh device details. Please try again.",
                                "Close",
                                { duration: 3000 },
                            );
                        },
                    );
            }
        });
    }

    getJobStatus(): void {
        if (this.jobId) {
            this.facade.getJobStatus(this.jobId).subscribe(
                (response) => {
                    if (response.status === "completed") {
                        this.showRefreshProgress = false;
                        this.inventoryItem$
                            .pipe(takeUntil(this.destroy$))
                            .subscribe((item) => {
                                if (item) {
                                    this.facade.getDevice(item.uuid);
                                }
                            });
                    } else {
                        setTimeout(() => this.getJobStatus(), 2000);
                    }
                },
                (error) => {
                    console.error("Error checking job status:", error);
                    this.showRefreshProgress = false;
                    this.showRefreshError = true;
                    this.snackBar.open(
                        "Failed to check job status. Please try again.",
                        "Close",
                        { duration: 3000 },
                    );
                },
            );
        }
    }

    updateDevice(): void {
        this.facade.updateDevice().subscribe(
            () => {
                this.router.navigate(["/inventory"]);
            },
            (error) => {
                console.error("Error updating inventory item:", error);
                this.snackBar.open(
                    "Failed to update inventory item. Please try again.",
                    "Close",
                    { duration: 3000 },
                );
            },
        );
    }
}
