// src/app/pages/inventory-delete-dialog/inventory-delete-dialog.ts

import { Component, Inject } from "@angular/core";
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";

@Component({
    selector: "app-delete-dialog",
    templateUrl: "./inventory-delete-dialog.html",
    styleUrls: ["./inventory-delete-dialog.scss"],
    standalone: true,
    imports: [MatButtonModule, MatDialogModule],
})
export class InventoryDeleteDialogComponent {
    constructor(
        public dialogRef: MatDialogRef<InventoryDeleteDialogComponent>,
        @Inject(MAT_DIALOG_DATA)
        public data: { title: string; message: string },
    ) {}

    /**
     * Closes the dialog without any action.
     *
     * @return
     */
    onNoClick(): void {
        this.dialogRef.close(false);
    }

    /**
     * Closes the dialog with a "true" value indicating that the yes button was clicked.
     *
     * @return
     */
    onYesClick(): void {
        this.dialogRef.close(true);
    }
}
