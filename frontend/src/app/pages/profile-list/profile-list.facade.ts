/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-len */
// src/app/pages/profile-list/profile-list.facade.ts

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { ProfileService } from "../../shared/services/profile.service";
import { Profile } from "../../shared/interfaces/profile.interface";

@Injectable()
export class ProfileListFacade {
    constructor(private profileService: ProfileService) {}

    getProfiles(): Observable<Profile[]> {
        return this.profileService.getProfiles();
    }

    deleteProfile(uuid: string): Observable<any> {
        return this.profileService.deleteProfile(uuid);
    }
}
