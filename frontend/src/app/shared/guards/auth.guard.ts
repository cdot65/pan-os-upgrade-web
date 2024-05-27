// src/app/shared/guards/auth.guard.ts

import { CanActivateFn, Router } from "@angular/router";

import { CookieService } from "ngx-cookie-service";
import { inject } from "@angular/core";

export const authGuard: CanActivateFn = () => {
    const router = inject(Router);
    const cookieService = inject(CookieService);

    const authToken = cookieService.get("auth_token");

    if (authToken) {
        return true;
    } else {
        router.navigate(["/auth/login"]);
        return false;
    }
};
