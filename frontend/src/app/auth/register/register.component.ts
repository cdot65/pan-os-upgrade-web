import { catchError, of } from 'rxjs';

import { AuthService } from '../auth.service';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
    ],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.scss'],
})
export class RegisterComponent {
    username = '';
    email = '';
    password1 = '';
    password2 = '';

    constructor(private authService: AuthService) {}

    onSubmit() {
        this.authService
            .register(this.username, this.email, this.password1, this.password2)
            .pipe(
                catchError((error) => {
                    // Handle registration error
                    console.error(error);
                    return of(null); // Return an observable with a null value
                })
            )
            .subscribe({
                next: (response) => {
                    // Handle successful registration
                    console.log(response);
                    // Redirect to login page or perform any other necessary actions
                },
                error: (error) => {
                    // Handle any errors that occur during the subscription
                    console.error(error);
                },
            });
    }
}
