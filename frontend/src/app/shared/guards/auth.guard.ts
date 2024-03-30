// src/app/shared/guards/auth.guard.ts

import { CanActivateFn, Router } from "@angular/router";

import { inject } from "@angular/core";

export const authGuard: CanActivateFn = () => {
    const router = inject(Router);

    const authToken = localStorage.getItem("auth_token");

    if (authToken) {
        return true;
    } else {
        router.navigate(["/auth/login"]);
        return false;
    }
};
