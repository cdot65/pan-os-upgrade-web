// src/app/pages/profile-list/profile-list.ts

import {
    AfterViewInit,
    Component,
    HostBinding,
    OnInit,
    ViewChild,
} from "@angular/core";
import { MatSort, MatSortModule, Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";

import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "src/app/shared/footer/footer";
import { InventoryDeleteDialogComponent } from "../inventory-delete-dialog/inventory-delete-dialog";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfilePageHeader } from "../profile-page-header/profile-page-header";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { SelectionModel } from "@angular/cdk/collections";
import { forkJoin } from "rxjs";

@Component({
    selector: "app-profile-list",
    templateUrl: "./profile-list.html",
    styleUrls: ["./profile-list.scss"],
    standalone: true,
    imports: [
        Footer,
        MatCheckboxModule,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
        ProfilePageHeader,
    ],
})
export class ProfileListComponent implements OnInit, AfterViewInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    profiles: Profile[] = [];
    displayedColumns: string[] = ["select", "name", "description", "edit"];
    dataSource: MatTableDataSource<Profile> = new MatTableDataSource<Profile>(
        [],
    );
    selection = new SelectionModel<Profile>(true, []);

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private profileService: ProfileService,
        private router: Router,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
        private dialog: MatDialog,
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
        this.profileService.getProfiles().subscribe(
            (items) => {
                this.profiles = items;
                this.profiles.sort((a, b) => a.name.localeCompare(b.name));

                this.dataSource = new MatTableDataSource(this.profiles);
                this.dataSource.sort = this.sort;
            },
            (error) => {
                console.error("Error fetching settings profiles:", error);
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

    ngOnInit(): void {
        this._componentPageTitle.title = "Settings Profile List";
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

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if (result) {
                this.profileService.deleteProfile(profile.uuid).subscribe(
                    () => {
                        this.getProfiles();
                    },
                    (error) => {
                        console.error("Error deleting inventory item:", error);
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

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if (result) {
                const deleteRequests = selectedItems.map((item) =>
                    this.profileService.deleteProfile(item.uuid),
                );
                forkJoin(deleteRequests).subscribe(
                    () => {
                        this.selection.clear();
                        this.getProfiles();
                    },
                    (error) => {
                        console.error("Error deleting inventory items:", error);
                    },
                );
            }
        });
    }

    onEditClick(item: Profile): void {
        this.router.navigate(["/profiles", item.uuid]);
    }
}
