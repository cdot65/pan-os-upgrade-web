/* eslint-disable @typescript-eslint/naming-convention */
// src/app/pages/profile-details/profile-details.ts

import { ActivatedRoute, Router } from "@angular/router";
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import {
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from "@angular/forms";

import { CommonModule } from "@angular/common";
import { ComponentPageTitle } from "../page-title/page-title";
import { Footer } from "src/app/shared/footer/footer";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatOptionModule } from "@angular/material/core";
import { MatRadioModule } from "@angular/material/radio";
import { MatSelectModule } from "@angular/material/select";
import { MatSliderModule } from "@angular/material/slider";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileService } from "../../shared/services/profile.service";
import { Subject } from "rxjs";
import { takeUntil } from "rxjs/operators";

@Component({
    selector: "app-profile-details",
    templateUrl: "./profile-details.html",
    styleUrls: ["./profile-details.scss"],
    standalone: true,
    imports: [
        CommonModule,
        Footer,
        MatButtonModule,
        MatCardModule,
        MatCheckboxModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        MatOptionModule,
        MatSelectModule,
        MatRadioModule,
        MatSliderModule,
        ReactiveFormsModule,
    ],
})

/**
 * Represents the component for displaying and managing an upgrade profile details.
 */
export class ProfileDetailsComponent implements OnInit, OnDestroy {
    // Host bind the main-content class to the component, allowing for styling
    @HostBinding("class.main-content") readonly mainContentClass = true;
    profile: Profile | undefined;
    updateProfileForm: FormGroup;
    private destroy$ = new Subject<void>();

    constructor(
        private formBuilder: FormBuilder,
        private profileService: ProfileService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MatSnackBar,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.updateProfileForm = this.formBuilder.group({
            description: [""],
            download: this.formBuilder.group({
                max_download_tries: [22],
                download_retry_interval: [33],
            }),
            install: this.formBuilder.group({
                max_install_attempts: [33],
                install_retry_interval: [66],
            }),
            name: ["", Validators.required],
            readiness_checks: this.formBuilder.group({
                checks: this.formBuilder.group({
                    active_support_check: [true],
                    arp_entry_exist_check: [false],
                    candidate_config_check: [true],
                    certificates_requirements_check: [false],
                    content_version_check: [true],
                    dynamic_updates_check: [true],
                    expired_licenses_check: [true],
                    free_disk_space_check: [true],
                    ha_check: [true],
                    ip_sec_tunnel_status_check: [true],
                    jobs_check: [false],
                    ntp_sync_check: [false],
                    panorama_check: [true],
                    planes_clock_sync_check: [true],
                    session_exist_check: [false],
                }),
                readiness_checks_location: ["assurance/readiness_checks/"],
            }),
            reboot: this.formBuilder.group({
                max_reboot_tries: [33],
                reboot_retry_interval: [66],
            }),
            snapshots: this.formBuilder.group({
                snapshots_location: ["assurance/snapshots/"],
                max_snapshot_tries: [33],
                snapshot_retry_interval: [66],
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
                command_timeout: [123321],
                connection_timeout: [33],
            }),
            authentication: this.formBuilder.group({
                pan_username: ["", Validators.required],
                pan_password: ["", Validators.required],
            }),
        });
    }

    getProfile(uuid: string): void {
        this.profileService
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
                        "Failed to fetch profile. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit(): void {
        this._componentPageTitle.title = "Profile Details";
        const uuid = this.route.snapshot.paramMap.get("uuid");
        if (uuid) {
            this.getProfile(uuid);
        }
    }

    onCancel(): void {
        this.updateProfileForm.reset();
        this.router.navigate(["/profiles"]);
    }

    updateProfile(): void {
        if (this.profile && this.updateProfileForm.valid) {
            const updatedProfile = {
                ...this.profile,
                ...this.updateProfileForm.value,
            };
            this.profileService
                .updateProfile(updatedProfile, this.profile.uuid)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    () => {
                        this.router.navigate(["/profiles"]);
                    },
                    (error) => {
                        console.error("Error updating profile:", error);
                        this.snackBar.open(
                            "Failed to update profile. Please try again.",
                            "Close",
                            {
                                duration: 3000,
                            },
                        );
                    },
                );
        }
    }
}
