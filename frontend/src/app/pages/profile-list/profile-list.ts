// src/app/pages/profile-list/profile-list.ts

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
import { Subject, forkJoin } from "rxjs";

import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryDeleteDialogComponent } from "../inventory-delete-dialog/inventory-delete-dialog";
import { Layout } from "../../shared/layout/layout";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { SelectionModel } from "@angular/cdk/collections";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-profile-list",
    templateUrl: "./profile-list.html",
    styleUrls: ["./profile-list.scss"],
    standalone: true,
    imports: [
        Footer,
        Layout,
        MatCheckboxModule,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
    ],
})
export class ProfileListComponent implements OnInit, AfterViewInit, OnDestroy {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    profiles: Profile[] = [];
    displayedColumns: string[] = ["select", "name", "description", "details"];
    dataSource: MatTableDataSource<Profile> = new MatTableDataSource<Profile>(
        [],
    );
    selection = new SelectionModel<Profile>(true, []);
    private destroy$ = new Subject<void>();

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private dialog: MatDialog,
        private profileService: ProfileService,
        private router: Router,
        private snackBar: MatSnackBar,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
    ) {}

    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }

    checkboxLabel(row?: Profile): string {
        if (!row) {
            return `${this.isAllSelected() ? "select" : "deselect"} all`;
        }
        return `${this.selection.isSelected(row) ? "deselect" : "select"} row ${row.name}`;
    }

    getProfiles(): void {
        this.profileService
            .getProfiles()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (items) => {
                    this.profiles = items;
                    this.profiles.sort((a, b) => a.name.localeCompare(b.name));

                    this.dataSource = new MatTableDataSource(this.profiles);
                    this.dataSource.sort = this.sort;
                },
                (error) => {
                    console.error("Error fetching settings profiles:", error);
                    this.snackBar.open(
                        "Failed to fetch settings profiles. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    isAllSelected() {
        const numSelected = this.selection.selected.length;
        const numRows = this.dataSource.data.length;
        return numSelected === numRows;
    }

    masterToggle() {
        if (this.isAllSelected()) {
            this.selection.clear();
        } else {
            this.dataSource.data.forEach((row) => this.selection.select(row));
        }
    }

    navigateToCreateSecurityProfile(): void {
        this.router.navigate(["/profiles/create"]);
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Profile List";
        this.getProfiles();
    }

    onDeleteClick(profile: Profile): void {
        const dialogRef = this.dialog.open(InventoryDeleteDialogComponent, {
            width: "300px",
            data: {
                title: "Confirm Delete",
                message: "Are you sure you want to delete this profile?",
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result: boolean) => {
                if (result) {
                    this.profileService
                        .deleteProfile(profile.uuid)
                        .pipe(takeUntil(this.destroy$))
                        .subscribe(
                            () => {
                                this.getProfiles();
                            },
                            (error) => {
                                console.error("Error deleting profile:", error);
                                this.snackBar.open(
                                    "Failed to delete profile. Please try again.",
                                    "Close",
                                    {
                                        duration: 3000,
                                    },
                                );
                            },
                        );
                }
            });
    }

    onDeleteSelectedClick() {
        const selectedItems = this.selection.selected;
        const dialogRef = this.dialog.open(InventoryDeleteDialogComponent, {
            width: "300px",
            data: {
                title: "Confirm Delete",
                // eslint-disable-next-line max-len
                message: `Are you sure you want to delete ${selectedItems.length} selected profiles(s)?`,
            },
        });

        dialogRef
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result: boolean) => {
                if (result) {
                    const deleteRequests = selectedItems.map((item) =>
                        this.profileService.deleteProfile(item.uuid),
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
                                    "Failed to delete selected profiles. Please try again.",
                                    "Close",
                                    {
                                        duration: 3000,
                                    },
                                );
                            },
                        );
                }
            });
    }

    onEditClick(item: Profile): void {
        this.router.navigate(["/profiles", item.uuid]);
    }
}
