// frontend/src/app/views/dashboard/dashboard.component.ts

import { Component, OnInit } from '@angular/core';

import { ThemePalette } from '@angular/material/core';

@Component({
    templateUrl: 'dashboard.component.html',
    styleUrls: ['dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
    links = ['Deploy', 'Configuration', 'Operations', 'Assessments'];
    activeLink = this.links[0];
    background: ThemePalette = 'primary';

    constructor() {}

    ngOnInit(): void {}
}
