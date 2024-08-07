/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-create/profile-create.service.ts

import { Injectable } from "@angular/core";
import { FormGroup } from "@angular/forms";

@Injectable({
    providedIn: "root",
})
export class ProfileCreateProcessorService {
    validateForm(form: FormGroup): boolean {
        return form.valid;
    }

    // Add any additional processing methods here
}
