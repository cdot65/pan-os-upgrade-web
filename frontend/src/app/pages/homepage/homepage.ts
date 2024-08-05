// src/app/pages/homepage/homepage.ts

import { Component, HostBinding, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { MatCardModule } from "@angular/material/card";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header.component";
import { HomepageFacade } from "./homepage.facade";

@Component({
    selector: "app-homepage",
    templateUrl: "./homepage.html",
    styleUrls: ["./homepage.scss"],
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        RouterLink,
        MatDividerModule,
        MatIconModule,
        MatCardModule,
        NgxChartsModule,
        PageHeaderComponent,
    ],
    providers: [HomepageFacade],
})
export class Homepage implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;

    config = this.facade.getConfig();

    panOsVersionData$ = this.facade.getPanOsVersionData();
    appIdVersionData$ = this.facade.getAppIdVersionData();
    swVersionByDeviceGroupData$ = this.facade.getSwVersionByDeviceGroupData();
    appVersionByDeviceGroupData$ = this.facade.getAppVersionByDeviceGroupData();
    jobData$ = this.facade.getJobData();

    constructor(private facade: HomepageFacade) {}

    ngOnInit(): void {
        this.facade.loadData();
    }
}
