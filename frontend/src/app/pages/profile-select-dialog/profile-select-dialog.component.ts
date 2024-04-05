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

@Component({
    selector: "app-profile-select-dialog",
    templateUrl: "./profile-select-dialog.component.html",
    styleUrls: ["./profile-select-dialog.component.scss"],
    standalone: true,
    imports: [
        MatButtonModule,
        MatDialogModule,
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
    ) {}

    ngOnInit(): void {
        this.profiles$ = this.profileService.getProfiles();
    }

    onCancelClick(): void {
        this.dialogRef.close();
    }

    onSelectClick(): void {
        this.dialogRef.close(this.selectedProfile);
    }
}
