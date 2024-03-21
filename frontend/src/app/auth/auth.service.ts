import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    private apiUrl = 'http://backend:8000/api/v1/';

    constructor(private http: HttpClient) {}

    login(username: string, password: string): Observable<any> {
        return this.http.post(`${this.apiUrl}dj-rest-auth/login/`, {
            username,
            password,
        });
    }

    logout(): Observable<any> {
        return this.http.post(`${this.apiUrl}dj-rest-auth/logout/`, {});
    }

    register(
        username: string,
        email: string,
        password1: string,
        password2: string
    ): Observable<any> {
        return this.http.post(`${this.apiUrl}dj-rest-auth/registration/`, {
            username,
            email,
            password1,
            password2,
        });
    }
}
