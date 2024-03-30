// src/app/pages/confirmation-dialog/delete-dialog.ts

import { Component, Inject } from "@angular/core";
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";

@Component({
    selector: "app-delete-dialog",
    templateUrl: "./delete-dialog.html",
    styleUrls: ["./delete-dialog.scss"],
    standalone: true,
    imports: [MatButtonModule, MatDialogModule],
})
export class DeleteDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<DeleteDialogComponent>,
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
