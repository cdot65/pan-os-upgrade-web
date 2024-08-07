/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/profile-create/profile-create.component.ts

import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { FormGroup, ReactiveFormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { ProfileCreateFacade } from "./profile-create.facade";
import { ProfileCreateProcessorService } from "./profile-create.processor.service";
import { PROFILE_CREATE_CONFIG } from "./profile-create.config";

@Component({
    selector: "app-profile-create",
    templateUrl: "./profile-create.component.html",
    styleUrls: ["./profile-create.component.scss"],
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        PageHeaderComponent,
    ],
    providers: [ProfileCreateFacade],
})
export class ProfileCreateComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    config = PROFILE_CREATE_CONFIG;
    createProfileForm: FormGroup;
    private destroy$ = new Subject<void>();

    constructor(
        private facade: ProfileCreateFacade,
        private processor: ProfileCreateProcessorService,
    ) {
        this.createProfileForm = this.facade.createProfileForm();
    }

    ngOnInit(): void {}

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    createProfile(): void {
        if (this.processor.validateForm(this.createProfileForm)) {
            const formValue = this.createProfileForm.value;
            this.facade
                .createProfile(formValue)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    () => {
                        this.facade.navigateToProfiles();
                    },
                    (error) => {
                        console.error("Error creating profile:", error);
                        this.facade.showErrorSnackBar(
                            "Failed to create profile. Please try again.",
                        );
                    },
                );
        }
    }

    onCancel(): void {
        this.createProfileForm.reset();
        this.facade.navigateToProfiles();
    }
}
