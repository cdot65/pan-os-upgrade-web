/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Observable, Subject, throwError, timer } from "rxjs";
import { mergeMap, retryWhen, switchMap, takeUntil, takeWhile, tap } from "rxjs/operators";
import { UpgradeJob, UpgradeResponse } from "../../shared/interfaces/upgrade-response.interface";
import { ComponentPageTitle } from "../page-title/page-title";
import { Device } from "../../shared/interfaces/device.interface";
import { InventoryService } from "../../shared/services/inventory.service";
import { JobService } from "src/app/shared/services/job.service";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatRadioModule } from "@angular/material/radio";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { PanosVersion } from "../../shared/interfaces/panos-version.interface";
import { Profile } from "../../shared/interfaces/profile.interface";
import { ProfileService } from "../../shared/services/profile.service";
import { Router } from "@angular/router";
import { UpgradeForm } from "../../shared/interfaces/upgrade-form.interface";
import { UpgradeService } from "../../shared/services/upgrade.service";
import { AsyncPipe } from "@angular/common";
import { HttpErrorResponse } from "@angular/common/http";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";

@Component({
    selector: "app-upgrade-list",
    templateUrl: "./upgrade-list.component.html",
    styleUrls: ["./upgrade-list.component.scss"],
    standalone: true,
    imports: [
        AsyncPipe,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatSelectModule,
        MatButtonModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
        MatCardModule,
        MatProgressBarModule,
        MatRadioModule,
        PageHeaderComponent,
    ],
})
export class UpgradeListComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    // Component page details
    pageTitle = "Upgrade Devices";
    pageDescription = "Upgrade your PAN-OS devices to the latest version";
    breadcrumbs = [
        { label: "Home", url: "/" },
        { label: "Upgrades", url: "/upgrades" },
    ];

    devices: Device[] = [];
    jobStatuses: { [jobId: string]: string } = {};
    pollingSubscriptions: { [jobId: string]: Subject<void> } = {};
    profiles: Profile[] = [];
    step = 0;
    // target_versions: string[] = ["10.1.3", "10.2.9-h1", "11.1.1-h1"];
    syncVersions$: Observable<boolean>;
    target_versions: PanosVersion[] = [];
    upgradeForm: FormGroup;
    upgradeJobs: UpgradeJob[] = [];
    private destroy$ = new Subject<void>();

    constructor(
        private inventoryService: InventoryService,
        private profileService: ProfileService,
        public upgradeService: UpgradeService,
        private jobService: JobService,
        private router: Router,
        private snackBar: MatSnackBar,
        private formBuilder: FormBuilder,
        public _componentPageTitle: ComponentPageTitle,
    ) {
        this.upgradeForm = this.formBuilder.group({
            devices: [[], Validators.required],
            dry_run: [true],
            profile: ["", Validators.required],
            target_version: ["", Validators.required],
            scheduledAt: [""],
        });
        this.syncVersions$ = this.upgradeService.syncVersions$;
    }

    private pollJobStatus(jobId: string): Observable<string> {
        return timer(2000).pipe(
            switchMap(() =>
                timer(0, 2000).pipe(
                    switchMap(() => this.jobService.getJobStatus(jobId)),
                    tap((status) => {
                        this.snackBar.open(
                            `Job status for job ID ${jobId}: ${status}`,
                            "Close",
                            {
                                duration: 5000,
                                verticalPosition: "bottom",
                            },
                        );
                    }),
                    takeWhile(
                        (status) =>
                            status !== "completed" && status !== "errored",
                        true,
                    ),
                    takeUntil(this.destroy$),
                    takeUntil(timer(300000)), // 5 minutes timeout
                ),
            ),
        );
    }

    private shouldRetry(error: HttpErrorResponse): boolean {
        return error.status >= 500 || error.error instanceof ErrorEvent;
    }

    checkDeviceEligibility(deviceId: string): boolean {
        const device = this.devices.find((d) => d.uuid === deviceId);
        if (device) {
            if (
                device.local_state === "passive" ||
                device.local_state === "active-secondary" ||
                device.ha_enabled === false
            ) {
                return true;
            }
        }
        return false;
    }

    getDeviceHaProperties(deviceId: string): {
        ha_enabled: boolean;
        local_state: string | null;
        peer_ip: string | null;
        peer_state: string | null;
    } {
        const device = this.devices.find((d) => d.uuid === deviceId);
        if (device && device.ha_enabled) {
            return {
                ha_enabled: true,
                local_state: device.local_state || null,
                peer_ip: device.peer_ip || null,
                peer_state: device.peer_state || null,
            };
        } else {
            return {
                ha_enabled: false,
                local_state: "n/a",
                peer_ip: "n/a",
                peer_state: "n/a",
            };
        }
    }

    getDeviceHostname(deviceId: string): string {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.hostname : "";
    }

    getDevices(): void {
        this.inventoryService
            .getDevices()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (devices) => {
                    this.devices = devices.filter(
                        (device) => device.device_type === "Firewall",
                    );
                },
                (error) => {
                    console.error("Error fetching devices:", error);
                    this.snackBar.open(
                        "Failed to fetch devices. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    getPanosVersions(): void {
        this.upgradeService
            .getPanosVersions()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (versions: PanosVersion[]) => {
                    this.target_versions = versions;
                },
                (error) => {
                    console.error("Error fetching PAN-OS versions:", error);
                    this.snackBar.open(
                        "Failed to fetch PAN-OS versions. Please try again.",
                        "Close",
                        {
                            duration: 3000,
                        },
                    );
                },
            );
    }

    getProfiles(): void {
        this.profileService
            .getProfiles()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (profiles) => {
                    this.profiles = profiles;
                },
                (error) => {
                    console.error("Error fetching profiles:", error);
                    this.snackBar.open(
                        "Failed to fetch profiles. Please try again.",
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
        this._componentPageTitle.title = this.pageTitle;
        this.getDevices();
        this.getProfiles();
        this.getPanosVersions();

        this.upgradeService.syncVersions$
            .pipe(takeUntil(this.destroy$))
            .subscribe((isSyncing) => {
                if (!isSyncing) {
                    this.getPanosVersions();
                }
            });
    }

    onUpgradeClick(): void {
        if (this.upgradeForm.valid) {
            const upgradeFormData: UpgradeForm = {
                author: 1, // Replace with the actual author ID
                devices: this.upgradeForm.get("devices")?.value,
                dry_run: this.upgradeForm.get("dry_run")?.value,
                profile: this.upgradeForm.get("profile")?.value,
                target_version: this.upgradeForm.get("target_version")?.value,
            };

            this.upgradeService
                .upgradeDevice(upgradeFormData)
                .pipe(takeUntil(this.destroy$))
                .subscribe(
                    (response: UpgradeResponse | null) => {
                        if (response && response.upgrade_jobs) {
                            this.upgradeJobs = response.upgrade_jobs;
                            this.upgradeJobs.forEach((job) => {
                                this.jobStatuses[job.job] = "pending";
                                this.startPollingJobStatus(job.job);
                            });
                            this.snackBar.open(
                                "Upgrade initiated successfully.",
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                        } else {
                            this.snackBar.open(
                                "Failed to initiate the upgrade. Please try again.",
                                "Close",
                                {
                                    duration: 3000,
                                },
                            );
                        }
                    },
                    (error) => {
                        console.error("Error upgrading device:", error);
                        this.snackBar.open(
                            "Failed to initiate the upgrade. Please try again.",
                            "Close",
                            {
                                duration: 3000,
                            },
                        );
                    },
                );

            this.step = 4;
        }
    }

    startPollingJobStatus(jobId: string): void {
        const pollingSubject = new Subject<void>();
        this.pollingSubscriptions[jobId] = pollingSubject;

        timer(0, 5000)
            .pipe(takeUntil(pollingSubject))
            .subscribe(() => {
                this.jobService.getJobStatus(jobId).subscribe((status) => {
                    this.jobStatuses[jobId] = status;
                    if (
                        status === "completed" ||
                        status === "skipped" ||
                        status === "errored"
                    ) {
                        this.stopPollingJobStatus(jobId);
                    }
                });
            });
    }

    stopPollingJobStatus(jobId: string): void {
        if (this.pollingSubscriptions[jobId]) {
            this.pollingSubscriptions[jobId].next();
            this.pollingSubscriptions[jobId].complete();
            delete this.pollingSubscriptions[jobId];
        }
    }

    syncVersionsFromDevice(): void {
        const selectedDevices = this.upgradeForm.get("devices")?.value;
        const selectedProfile = this.upgradeForm.get("profile")?.value;
        if (selectedDevices && selectedDevices.length > 0 && selectedProfile) {
            const deviceId = selectedDevices[0];
            this.upgradeService
                .syncPanosVersions(deviceId, selectedProfile)
                .pipe(
                    takeUntil(this.destroy$),
                    retryWhen((errors) =>
                        errors.pipe(
                            mergeMap((error, i) => {
                                const retryAttempt = i + 1;
                                if (
                                    retryAttempt <= 3 &&
                                    this.shouldRetry(error)
                                ) {
                                    return timer(
                                        Math.pow(2, retryAttempt) * 1000,
                                    );
                                }
                                return throwError(() => error);
                            }),
                        ),
                    ),
                    switchMap((jobId: string | null) => {
                        if (jobId) {
                            this.snackBar.open(
                                `Sync job started with ID: ${jobId}`,
                                "Close",
                                { duration: 3000 },
                            );
                            return this.pollJobStatus(jobId);
                        } else {
                            return throwError(
                                () => new Error("No job ID returned"),
                            );
                        }
                    }),
                )
                .subscribe(
                    (status: string) => {
                        if (status === "completed") {
                            this.getPanosVersions();
                            this.snackBar.open(
                                `PAN-OS versions synced successfully for device ${this.getDeviceHostname(deviceId)}.`,
                                "Close",
                                { duration: 5000 },
                            );
                        } else if (status === "errored") {
                            this.snackBar.open(
                                "Failed to sync PAN-OS versions. Please try again.",
                                "Close",
                                { duration: 3000 },
                            );
                        }
                    },
                    (error) => {
                        console.error("Error syncing PAN-OS versions:", error);
                        this.snackBar.open(
                            "Failed to sync PAN-OS versions. Please try again.",
                            "Close",
                            { duration: 3000 },
                        );
                    },
                );
        } else {
            this.snackBar.open(
                "Please select at least one device and a profile before syncing versions.",
                "Close",
                { duration: 3000 },
            );
        }
    }

    viewJobDetails(jobId: string): void {
        const url = this.router.serializeUrl(
            this.router.createUrlTree(["/jobs", jobId]),
        );
        window.open(url, "_blank");
    }
}
