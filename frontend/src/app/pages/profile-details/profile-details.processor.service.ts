/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-details/profile-details.processor.service.ts

import { Injectable } from "@angular/core";
import { Profile } from "../../shared/interfaces/profile.interface";

@Injectable()
export class ProfileDetailsProcessorService {
    mergeProfileWithForm(profile: Profile, formValue: any): Profile {
        return {
            ...profile,
            ...formValue,
        };
    }

    // Add other complex processing methods here if needed
}
