/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/profile-create/profile-create.ts

import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-profile-create",
    templateUrl: "./profile-create.html",
    styleUrls: ["./profile-create.scss"],
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
})
export class ProfileCreateComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    createProfileForm: FormGroup;
    private destroy$ = new Subject<void>();

    constructor(
        private formBuilder: FormBuilder,
        private profileService: ProfileService,
        private router: Router,
        private snackBar: MatSnackBar,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.createProfileForm = this.formBuilder.group({
            authentication: this.formBuilder.group({
                pan_username: ["", Validators.required],
                pan_password: ["", Validators.required],
            }),
            description: [""],
            download: this.formBuilder.group({
                max_download_tries: [3],
                download_retry_interval: [30],
            }),
            install: this.formBuilder.group({
                max_install_attempts: [3],
                install_retry_interval: [60],
            }),
            name: ["", Validators.required],
            readiness_checks: this.formBuilder.group({
                checks: this.formBuilder.group({
                    active_support: [true],
                    candidate_config: [true],
                    certificates_requirements: [false],
                    content_version: [true],
                    dynamic_updates: [true],
                    expired_licenses: [true],
                    free_disk_space: [true],
                    ha: [true],
                    jobs: [false],
                    ntp_sync: [false],
                    panorama: [true],
                    planes_clock_sync: [true],
                }),
            }),
            reboot: this.formBuilder.group({
                max_reboot_tries: [30],
                reboot_retry_interval: [60],
            }),
            snapshots: this.formBuilder.group({
                max_snapshot_tries: [3],
                snapshot_retry_interval: [60],
                state: this.formBuilder.group({
                    arp_table_snapshot: [false],
                    content_version_snapshot: [true],
                    ip_sec_tunnels_snapshot: [false],
                    license_snapshot: [true],
                    nics_snapshot: [true],
                    routes_snapshot: [false],
                    session_stats_snapshot: [false],
                }),
            }),
            timeout_settings: this.formBuilder.group({
                command_timeout: [120],
                connection_timeout: [30],
            }),
        });
    }

    createProfile(): void {
        if (this.createProfileForm && this.createProfileForm.valid) {
            const formValue = this.createProfileForm.value;
            this.profileService
                .createProfile(formValue)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    () => {
                        this.router.navigate(["/profiles"]);
                    },
                    (error) => {
                        console.error("Error creating profile:", error);
                        this.snackBar.open(
                            "Failed to create profile. Please try again.",
                            "Close",
                            {
                                duration: 3000,
                            },
                        );
                    },
                );
        }
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Create Settings Profile";
    }

    onCancel(): void {
        this.createProfileForm.reset();
        this.router.navigate(["/profiles"]);
    }
}
