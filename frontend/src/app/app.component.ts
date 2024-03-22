// frontend/src/app/app.component.ts

import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

import { Title } from '@angular/platform-browser';

@Component({
    selector: 'app-root',
    template: ` <router-outlet></router-outlet> `,
})
export class AppComponent implements OnInit {
    title = 'PAN-OS Upgrade';

    constructor(private router: Router, private titleService: Title) {
        titleService.setTitle(this.title);
    }

    ngOnInit(): void {
        this.router.events.subscribe((evt) => {
            if (!(evt instanceof NavigationEnd)) {
                return;
            }
        });
    }
}
