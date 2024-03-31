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
import { DeleteDialogComponent } from "../confirmation-dialog/delete-dialog";
import { Footer } from "src/app/shared/footer/footer";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { NgFor } from "@angular/common";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { SettingsPageHeader } from "../profile-page-header/profile-page-header";

@Component({
    selector: "app-profile-list",
    templateUrl: "./profile-list.html",
    styleUrls: ["./profile-list.scss"],
    standalone: true,
    imports: [
        NgFor,
        SettingsPageHeader,
        MatTableModule,
        MatSortModule,
        MatIconModule,
        MatButtonModule,
        Footer,
    ],
})
/**
 * Component for displaying the inventory list.
 */
export class ProfileListComponent implements OnInit, AfterViewInit {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    profiles: Profile[] = [];
    displayedColumns: string[] = ["name", "description", "edit", "delete"];
    dataSource: MatTableDataSource<Profile> = new MatTableDataSource<Profile>(
        [],
    );

    @ViewChild(MatSort) sort: MatSort = new MatSort();

    constructor(
        private profileService: ProfileService,
        private router: Router,
        private _liveAnnouncer: LiveAnnouncer,
        public _componentPageTitle: ComponentPageTitle,
        private dialog: MatDialog,
    ) {}

    ngOnInit(): void {
        this._componentPageTitle.title = "Settings Profile List";
        this.getProfiles();
    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort;
    }

    getProfiles(): void {
        this.profileService.getProfiles().subscribe(
            (items) => {
                this.profiles = items;
                this.dataSource = new MatTableDataSource(this.profiles);
                this.dataSource.sort = this.sort;
            },
            (error) => {
                console.error("Error fetching settings profiles:", error);
            },
        );
    }

    onEditClick(item: Profile): void {
        this.router.navigate(["/profiles", item.uuid]);
    }

    announceSortChange(sortState: Sort) {
        if (sortState.direction) {
            this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
        } else {
            this._liveAnnouncer.announce("Sorting cleared");
        }
    }

    navigateToCreateSecurityProfile(): void {
        this.router.navigate(["/profiles/create"]);
    }

    /**
     * Opens the delete dialog when the delete button is clicked.
     * @param item - The item to be deleted. It can be an Profile object.
     */
    onDeleteClick(profile: Profile): void {
        const dialogRef = this.dialog.open(DeleteDialogComponent, {
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
}
