import { catchError, of } from 'rxjs';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        HttpClientModule,
        RouterModule,
    ],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
    username = '';
    password = '';

    constructor(private authService: AuthService) {}

    onSubmit() {
        this.authService
            .login(this.username, this.password)
            .pipe(
                catchError((error) => {
                    // Handle login error
                    console.error(error);
                    return of(null); // Return an observable with a null value
                })
            )
            .subscribe({
                next: (response) => {
                    // Handle successful login
                    console.log(response);
                },
                error: (error) => {
                    // Handle any errors that occur during the subscription
                    console.error(error);
                },
            });
    }
}
