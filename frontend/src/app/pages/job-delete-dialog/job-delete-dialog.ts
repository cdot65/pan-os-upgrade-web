// src/app/pages/job-delete-dialog/job-delete-dialog.ts

import { Component, Inject } from "@angular/core";
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";

@Component({
    selector: "app-job-delete-dialog",
    templateUrl: "./job-delete-dialog.html",
    styleUrls: ["./job-delete-dialog.scss"],
    standalone: true,
    imports: [MatButtonModule, MatDialogModule],
})
export class JobDeleteDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<JobDeleteDialogComponent>,
        @Inject(MAT_DIALOG_DATA)
        public data: { title: string; message: string },
    ) {}

    onNoClick(): void {
        this.dialogRef.close(false);
    }

    onYesClick(): void {
        this.dialogRef.close(true);
    }
}
