/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
import { Component, HostBinding, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Observable, Subject, throwError, timer } from "rxjs";
import { mergeMap, retryWhen, switchMap, takeUntil, takeWhile, tap } from "rxjs/operators";
import { UpgradeJob, UpgradeResponse } from "../../shared/interfaces/upgrade-response.interface";
import { ComponentPageTitle } from "../page-title/page-title";
import { Device } from "../../shared/interfaces/device.interface";
import { MatSnackBar } from "@angular/material/snack-bar";
import { PanosVersion } from "../../shared/interfaces/panos-version.interface";
import { Profile } from "../../shared/interfaces/profile.interface";
import { Router } from "@angular/router";
import { UpgradeForm } from "../../shared/interfaces/upgrade-form.interface";
import { AsyncPipe } from "@angular/common";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";

import { UPGRADE_LIST_CONFIG } from "./upgrade-list.config";
import { UpgradeListFacade } from "./upgrade-list.facade";
import { UpgradeListProcessorService } from "./upgrade-list.processor.service";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import { MatCardModule } from "@angular/material/card";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatRadioModule } from "@angular/material/radio";

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
    providers: [UpgradeListFacade, UpgradeListProcessorService],
})
export class UpgradeListComponent implements OnInit, OnDestroy {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    config = UPGRADE_LIST_CONFIG;
    devices: Device[] = [];
    jobStatuses: { [jobId: string]: string } = {};
    pollingSubscriptions: { [jobId: string]: Subject<void> } = {};
    profiles: Profile[] = [];
    step = 0;
    syncVersions$: Observable<boolean>;
    target_versions: PanosVersion[] = [];
    upgradeForm: FormGroup;
    upgradeJobs: UpgradeJob[] = [];
    private destroy$ = new Subject<void>();

    constructor(
        private facade: UpgradeListFacade,
        private processor: UpgradeListProcessorService,
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
        this.syncVersions$ = this.facade.upgradeService.syncVersions$;
    }

    private pollJobStatus(jobId: string): Observable<string> {
        return timer(2000).pipe(
            switchMap(() =>
                timer(0, 2000).pipe(
                    switchMap(() => this.facade.getJobStatus(jobId)),
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

    checkDeviceEligibility(deviceId: string): boolean {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return this.processor.checkDeviceEligibility(device);
    }

    getDeviceHaProperties(deviceId: string): {
        ha_enabled: boolean;
        local_state: string | null;
        peer_ip: string | null;
        peer_state: string | null;
    } {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return this.processor.getDeviceHaProperties(device);
    }

    getDeviceHostname(deviceId: string): string {
        const device = this.devices.find((d) => d.uuid === deviceId);
        return device ? device.hostname : "";
    }

    ngOnInit(): void {
        this._componentPageTitle.title = this.config.pageTitle;
        this.getDevices();
        this.getProfiles();
        this.getPanosVersions();

        this.syncVersions$
            .pipe(takeUntil(this.destroy$))
            .subscribe((isSyncing) => {
                if (!isSyncing) {
                    this.getPanosVersions();
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    getDevices(): void {
        this.facade
            .getDevices()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (devices) => {
                    this.devices =
                        this.processor.filterFirewallDevices(devices);
                },
                (error) => {
                    console.error("Error fetching devices:", error);
                    this.snackBar.open(
                        this.config.errorMessages.fetchDevicesFailed,
                        "Close",
                        { duration: this.config.snackBarDuration },
                    );
                },
            );
    }

    getProfiles(): void {
        this.facade
            .getProfiles()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (profiles) => {
                    this.profiles = profiles;
                },
                (error) => {
                    console.error("Error fetching profiles:", error);
                    this.snackBar.open(
                        this.config.errorMessages.fetchProfilesFailed,
                        "Close",
                        { duration: this.config.snackBarDuration },
                    );
                },
            );
    }

    getPanosVersions(): void {
        this.facade
            .getPanosVersions()
            .pipe(takeUntil(this.destroy$))
            .subscribe(
                (versions: PanosVersion[]) => {
                    this.target_versions = versions;
                },
                (error) => {
                    console.error("Error fetching PAN-OS versions:", error);
                    this.snackBar.open(
                        this.config.errorMessages.fetchVersionsFailed,
                        "Close",
                        { duration: this.config.snackBarDuration },
                    );
                },
            );
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

            this.facade
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
                                { duration: this.config.snackBarDuration },
                            );
                        } else {
                            this.snackBar.open(
                                this.config.errorMessages.upgradeInitiateFailed,
                                "Close",
                                { duration: this.config.snackBarDuration },
                            );
                        }
                    },
                    (error) => {
                        console.error("Error upgrading device:", error);
                        this.snackBar.open(
                            this.config.errorMessages.upgradeInitiateFailed,
                            "Close",
                            { duration: this.config.snackBarDuration },
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
                this.facade.getJobStatus(jobId).subscribe((status: string) => {
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
            this.facade
                .syncPanosVersions(deviceId, selectedProfile)
                .pipe(
                    takeUntil(this.destroy$),
                    retryWhen((errors) =>
                        errors.pipe(
                            mergeMap((error, i) => {
                                const retryAttempt = i + 1;
                                if (
                                    retryAttempt <= this.config.maxRetries &&
                                    this.processor.shouldRetry(error)
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
                                { duration: this.config.snackBarDuration },
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
                                { duration: this.config.snackBarDuration },
                            );
                        } else if (status === "errored") {
                            this.snackBar.open(
                                this.config.errorMessages.syncVersionsFailed,
                                "Close",
                                { duration: this.config.snackBarDuration },
                            );
                        }
                    },
                    (error) => {
                        console.error("Error syncing PAN-OS versions:", error);
                        this.snackBar.open(
                            this.config.errorMessages.syncVersionsFailed,
                            "Close",
                            { duration: this.config.snackBarDuration },
                        );
                    },
                );
        } else {
            this.snackBar.open(
                this.config.errorMessages.selectDeviceAndProfile,
                "Close",
                { duration: this.config.snackBarDuration },
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
