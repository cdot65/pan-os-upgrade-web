/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-list/profile-list.component.ts

import {
    AfterViewInit,
    Component,
    HostBinding,
    OnDestroy,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { forkJoin, Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { ComponentPageTitle } from "../page-title/page-title";
import { InventoryDeleteDialogComponent } from "../inventory-delete-dialog/inventory-delete-dialog";
import { Layout } from "../../shared/components/layout/layout";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Profile } from "../../shared/interfaces/profile.interface";
import { Router } from "@angular/router";
import { SelectionModel } from "@angular/cdk/collections";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";

import { PROFILE_LIST_CONFIG } from "./profile-list.config";
import { ProfileListFacade } from "./profile-list.facade";
import { ProfileListProcessorService } from "./profile-list.processor.service";

@Component({
    selector: "app-profile-list",
    templateUrl: "./profile-list.component.html",
    styleUrls: ["./profile-list.component.scss"],
    standalone: true,
    imports: [
        Layout,
        MatCheckboxModule,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
        PageHeaderComponent,
    ],
    providers: [ProfileListFacade, ProfileListProcessorService],
})
export class ProfileListComponent implements OnInit, AfterViewInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    config = PROFILE_LIST_CONFIG;
    profiles: Profile[] = [];
    displayedColumns: string[] = this.config.displayedColumns;
    dataSource: MatTableDataSource<Profile> = new MatTableDataSource<Profile>(
        [],
    );
    selection = new SelectionModel<Profile>(true, []);
    private destroy$ = new Subject<void>();

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private dialog: MatDialog,
        private facade: ProfileListFacade,
        private processor: ProfileListProcessorService,
        private router: Router,
        private snackBar: MatSnackBar,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    ngOnInit(): void {
        this._componentPageTitle.title = this.config.pageTitle;
        this.getProfiles();
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    async announceSortChange(sortState: Sort): Promise<void> {
        try {
            if (sortState.direction) {
                await this._liveAnnouncer.announce(
                    `Sorted ${sortState.direction}ending`,
                );
            } else {
                await this._liveAnnouncer.announce("Sorting cleared");
            }
        } catch (error) {
            console.error("Error announcing sort change:", error);
        }
    }

    getProfiles(): void {
        this.facade
            .getProfiles()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (items) => {
                    this.profiles = this.processor.sortProfiles(items);
                    this.dataSource = new MatTableDataSource(this.profiles);
                    this.dataSource.sort = this.sort;
                },
                (error) => {
                    console.error("Error fetching settings profiles:", error);
                    this.snackBar.open(
                        this.config.errorMessages.fetchFailed,
                        "Close",
                        { duration: this.config.snackBarDuration },
                    );
                },
            );
    }

    isAllSelected() {
        return this.processor.isAllSelected(
            this.selection.selected.length,
            this.dataSource.data.length,
        );
    }

    masterToggle() {
        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            this.dataSource.data.forEach((row) => this.selection.select(row));
        }
    }

    checkboxLabel(row?: Profile): string {
        return this.processor.checkboxLabel(this.isAllSelected(), row);
    }

    async navigateToCreateSecurityProfile(): Promise<void> {
        try {
            await this.router.navigate(["/profiles/create"]);
        } catch (error) {
            console.error("Navigation error:", error);
        }
    }

    onDeleteSelectedClick() {
        const selectedItems = this.selection.selected;
        const dialogRef = this.dialog.open(InventoryDeleteDialogComponent, {
            width: this.config.deleteDialogWidth,
            data: {
                title: "Confirm Delete",
                message: `Are you sure you want to delete ${selectedItems.length} selected profiles(s)?`,
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result: boolean) => {
                if (result) {
                    const deleteRequests = selectedItems.map((item) =>
                        this.facade.deleteProfile(item.uuid),
                    );
                    forkJoin(deleteRequests)
                        .pipe(takeUntil(this.destroy$))
                        .subscribe(
                            () => {
                                this.selection.clear();
                                this.getProfiles();
                            },
                            (error) => {
                                console.error(
                                    "Error deleting profiles:",
                                    error,
                                );
                                this.snackBar.open(
                                    this.config.errorMessages
                                        .deleteSelectedFailed,
                                    "Close",
                                    { duration: this.config.snackBarDuration },
                                );
                            },
                        );
                }
            });
    }

    async onEditClick(item: Profile): Promise<void> {
        try {
            await this.router.navigate(["/profiles", item.uuid]);
        } catch (error) {
            console.error("Navigation error:", error);
        }
    }
}
