// frontend/src/app/views/dashboard/dashboard.module.ts

import { CommonModule } from '@angular/common';
import { DashboardComponent } from './dashboard.component';
import { DashboardRoutingModule } from './dashboard-routing.module';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
    imports: [
        DashboardRoutingModule,
        CommonModule,
        ReactiveFormsModule,
        MatCardModule,
        MatSnackBarModule,
        MatTabsModule,
        MatIconModule,
    ],
    declarations: [DashboardComponent],
})
export class DashboardModule {}
