// src/app/shared/interceptors/auth.interceptor.ts

import {
    HttpEvent,
    HttpHandler,
    HttpInterceptor,
    HttpRequest,
} from "@angular/common/http";

import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    intercept(
        request: HttpRequest<any>,
        next: HttpHandler,
    ): Observable<HttpEvent<any>> {
        const authToken = localStorage.getItem("auth_token");
        if (
            authToken &&
            request.url !==
                `${environment.apiUrl}${environment.apiEndpointToken}`
        ) {
            request = request.clone({
                setHeaders: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    Authorization: `Token ${authToken}`,
                },
            });
        }
        return next.handle(request);
    }
}
