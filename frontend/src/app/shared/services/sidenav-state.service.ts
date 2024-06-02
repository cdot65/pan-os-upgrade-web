import { Injectable, effect, signal } from "@angular/core";

@Injectable({
    providedIn: "root",
})
export class SidenavStateService {
    isExpanded = signal(true);

    constructor() {
        // Load initial state from localStorage
        const storedState = localStorage.getItem("sidenavExpanded");
        if (storedState) {
            this.isExpanded.set(JSON.parse(storedState));
        }

        // Save to localStorage whenever the signal changes
        effect(() => {
            localStorage.setItem(
                "sidenavExpanded",
                JSON.stringify(this.isExpanded()),
            );
        });
    }

    toggle() {
        this.isExpanded.update((expanded) => !expanded);
    }
}
