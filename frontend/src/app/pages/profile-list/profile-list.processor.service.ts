/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-list/profile-list.processor.service.ts

import { Injectable } from "@angular/core";
import { Profile } from "../../shared/interfaces/profile.interface";

@Injectable()
export class ProfileListProcessorService {
    sortProfiles(profiles: Profile[]): Profile[] {
        return profiles.sort((a, b) => a.name.localeCompare(b.name));
    }

    isAllSelected(selectedLength: number, totalLength: number): boolean {
        return selectedLength === totalLength;
    }

    checkboxLabel(isAllSelected: boolean, row?: Profile): string {
        if (!row) {
            return `${isAllSelected ? "deselect" : "select"} all`;
        }
        return `${isAllSelected ? "deselect" : "select"} row ${row.name}`;
    }
}
