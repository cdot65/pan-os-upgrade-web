// frontend/src/app/app-routing.module.ts

import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './auth.guard';
import { LoginComponent } from './views/pages/login/login.component';
import { NgModule } from '@angular/core';
import { Page404Component } from './views/pages/page404/page404.component';
import { Page500Component } from './views/pages/page500/page500.component';
import { RegisterComponent } from './views/pages/register/register.component';

const routes: Routes = [
    {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
    },
    {
        path: 'dashboard',
        loadChildren: () =>
            import('./views/dashboard/dashboard.module').then(
                (m) => m.DashboardModule
            ),
        canActivate: [AuthGuard],
    },
    {
        path: 'pages',
        loadChildren: () =>
            import('./views/pages/pages.module').then((m) => m.PagesModule),
        canActivate: [AuthGuard],
    },
    {
        path: '404',
        component: Page404Component,
        data: {
            title: 'Page 404',
        },
    },
    {
        path: '500',
        component: Page500Component,
        data: {
            title: 'Page 500',
        },
    },
    {
        path: 'login',
        component: LoginComponent,
        data: {
            title: 'Login Page',
        },
    },
    {
        path: 'register',
        component: RegisterComponent,
        data: {
            title: 'Register Page',
        },
    },
    { path: '**', redirectTo: 'dashboard' },
];

@NgModule({
    imports: [
        RouterModule.forRoot(routes, {
            scrollPositionRestoration: 'top',
            anchorScrolling: 'enabled',
            initialNavigation: 'enabledBlocking',
        }),
    ],
    exports: [RouterModule],
})
export class AppRoutingModule {}
