// frontend/src/app/views/dashboard/dashboard-routing.module.ts

import { RouterModule, Routes } from '@angular/router';

import { DashboardComponent } from './dashboard.component';
import { NgModule } from '@angular/core';

const routes: Routes = [
    {
        path: '',
        component: DashboardComponent,
        data: {
            title: 'Dashboard',
        },
    },
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class DashboardRoutingModule {}
