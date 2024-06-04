// src/app/shared/services/sorting.service.ts
import { Injectable, signal } from "@angular/core";

@Injectable({
    providedIn: "root",
})
export class SortingService {
    sortOrder = signal<"asc" | "desc">("desc");

    toggleSortOrder() {
        this.sortOrder.update((currentOrder) =>
            currentOrder === "asc" ? "desc" : "asc",
        );
    }
}
