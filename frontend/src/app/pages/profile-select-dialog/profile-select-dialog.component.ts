// src/app/pages/profile-select-dialog/profile-select-dialog.component.ts
import { Component, Inject, OnInit } from "@angular/core";
import {
    MAT_DIALOG_DATA,
    MatDialogRef,
    MatDialogModule,
} from "@angular/material/dialog";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileService } from "../../shared/services/profile.service";
import { Observable } from "rxjs";
import { MatButtonModule } from "@angular/material/button";
import { MatSelectModule } from "@angular/material/select";
import { AsyncPipe, NgForOf } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatProgressBarModule } from "@angular/material/progress-bar";

@Component({
    selector: "app-profile-select-dialog",
    templateUrl: "./profile-select-dialog.component.html",
    standalone: true,
    imports: [
        MatButtonModule,
        MatDialogModule,
        MatProgressBarModule,
        MatSelectModule,
        AsyncPipe,
        NgForOf,
        FormsModule,
    ],
})
export class ProfileDialogComponent implements OnInit {
    profiles$: Observable<Profile[]> = new Observable<Profile[]>();
    selectedProfile: string = "";

    constructor(
        public dialogRef: MatDialogRef<ProfileDialogComponent>,
        private profileService: ProfileService,
        @Inject(MAT_DIALOG_DATA) public data: { message: string },
    ) {
        // Set the width of the dialog
        this.dialogRef.updateSize("530px");
    }
    /**
     * Initializes the component and fetches the profiles from the profile service.
     *
     * @returns
     */
    ngOnInit(): void {
        this.profiles$ = this.profileService.getProfiles();
    }

    /**
     * Closes the dialog when the cancel button is clicked.
     * @returns
     */
    onCancelClick(): void {
        this.dialogRef.close();
    }

    /**
     * Executes when the select button is clicked.
     *
     * @returns
     */
    onSelectClick(): void {
        this.dialogRef.close(this.selectedProfile);
    }
}
