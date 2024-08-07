/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/profile-details/profile-details.component.ts

import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

import { ProfileDetailsFacade } from "./profile-details.facade";
import { ProfileDetailsProcessorService } from "./profile-details.processor.service";
import { PROFILE_DETAILS_CONFIG } from "./profile-details.config";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ComponentPageTitle } from "../page-title/page-title";
import { CommonModule } from "@angular/common";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatButton } from "@angular/material/button";

@Component({
    selector: "app-profile-details",
    templateUrl: "./profile-details.component.html",
    styleUrls: ["./profile-details.component.scss"],
    standalone: true,
    imports: [
        CommonModule,
        PageHeaderComponent,
        MatFormField,
        ReactiveFormsModule,
        MatInput,
        MatCheckbox,
        MatButton,
        MatLabel,
    ],
    providers: [ProfileDetailsFacade, ProfileDetailsProcessorService],
})
export class ProfileDetailsComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    config = PROFILE_DETAILS_CONFIG;
    profile: Profile | undefined;
    updateProfileForm: FormGroup;
    private destroy$ = new Subject<void>();

    constructor(
        private facade: ProfileDetailsFacade,
        private processor: ProfileDetailsProcessorService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MatSnackBar,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.updateProfileForm = this.facade.createProfileForm();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = this.config.pageTitle;
        const uuid = this.route.snapshot.paramMap.get("uuid");
        if (uuid) {
            this.getProfile(uuid);
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    getProfile(uuid: string): void {
        this.facade
            .getProfile(uuid)
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (profile: Profile) => {
                    this.profile = profile;
                    this.updateProfileForm.patchValue(profile);
                },
                (error: any) => {
                    console.error("Error fetching profile:", error);
                    this.snackBar.open(
                        this.config.errorMessages.fetchFailed,
                        "Close",
                        { duration: this.config.snackBarDuration },
                    );
                },
            );
    }

    onCancel(): void {
        this.updateProfileForm.reset();
        this.router.navigate(["/profiles"]);
    }

    updateProfile(): void {
        if (this.profile && this.updateProfileForm.valid) {
            const updatedProfile = this.processor.mergeProfileWithForm(
                this.profile,
                this.updateProfileForm.value,
            );
            this.facade
                .updateProfile(updatedProfile, this.profile.uuid)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    () => {
                        this.router.navigate(["/profiles"]);
                    },
                    (error) => {
                        console.error("Error updating profile:", error);
                        this.snackBar.open(
                            this.config.errorMessages.updateFailed,
                            "Close",
                            { duration: this.config.snackBarDuration },
                        );
                    },
                );
        }
    }
}
