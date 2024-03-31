// src/app/pages/settings-profile-list/settings-profile-list.ts

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
import { DeleteDialogComponent } from "../confirmation-dialog/delete-dialog";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { NgFor } from "@angular/common";
import { Router } from "@angular/router";
import { SettingsPageHeader } from "../settings-page-header/settings-page-header";
import { SettingsProfile } from "../../shared/interfaces/settings-profile.interface";
import { SettingsProfileService } from "../../shared/services/settings-profile.service";

@Component({
    selector: "app-settings-profile-list",
    templateUrl: "./settings-profile-list.html",
    styleUrls: ["./settings-profile-list.scss"],
    standalone: true,
    imports: [
        NgFor,
        SettingsPageHeader,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
    ],
})
/**
 * Component for displaying the inventory list.
 */
export class SettingsProfileListComponent implements OnInit, AfterViewInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    settingsProfiles: SettingsProfile[] = [];
    displayedColumns: string[] = ["profile", "description", "edit", "delete"];
    dataSource: MatTableDataSource<SettingsProfile> =
        new MatTableDataSource<SettingsProfile>([]);

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private settingsProfileService: SettingsProfileService,
        private router: Router,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
        private dialog: MatDialog,
    ) {}

    /**
     * Initializes the component.
     * Sets the page title to "Inventory List" and retrieves the inventory items.
     */
    ngOnInit(): void {
        this._componentPageTitle.title = "Settings Profile List";
        this.getSettingsProfiles();
    }

    /**
     * Lifecycle hook that is called after Angular has fully initialized the component's view.
     * It is called after the view has been rendered and all child views have been initialized.
     * This hook performs additional initialization tasks that require the view to be rendered.
     */
    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    /**
     * Retrieves items from the inventory service and sets up the data source for the table.
     */
    getSettingsProfiles(): void {
        this.settingsProfileService.getProfiles().subscribe(
            (items) => {
                this.settingsProfiles = items;
                this.dataSource = new MatTableDataSource(this.settingsProfiles);
                this.dataSource.sort = this.sort;
            },
            (error) => {
                console.error("Error fetching settings profiles:", error);
            },
        );
    }

    /**
     * Navigates to the inventory page for editing the specified item.
     * @param item - The item to be edited. It can be an SettingsProfile object.
     */
    onEditClick(item: SettingsProfile): void {
        this.router.navigate(["/settings/profiles", item.uuid]);
    }

    /**
     * Announces the change in sorting state.
     *
     * @param sortState - The new sorting state.
     */
    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }

    navigateToCreateInventory(): void {
        this.router.navigate(["/settings/profiles"]);
    }

    /**
     * Opens the delete dialog when the delete button is clicked.
     * @param item - The item to be deleted. It can be an SettingsProfile object.
     */
    onDeleteClick(item: SettingsProfile): void {
        const dialogRef = this.dialog.open(DeleteDialogComponent, {
            width: "300px",
            data: {
                title: "Confirm Delete",
                message:
                    "Are you sure you want to delete this settings profile?",
            },
        });

        dialogRef.afterClosed().subscribe((result: boolean) => {
            if (result) {
                this.settingsProfileService
                    .deleteSettingsProfile(item.uuid)
                    .subscribe(
                        () => {
                            this.getSettingsProfiles();
                        },
                        (error) => {
                            console.error(
                                "Error deleting inventory item:",
                                error,
                            );
                        },
                    );
            }
        });
    }
}
