import { catchError, of } from 'rxjs';

import { AuthService } from '../auth.service';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-logout',
    standalone: true,
    imports: [MatButtonModule],
    templateUrl: './logout.component.html',
    styleUrls: ['./logout.component.scss'],
})
export class LogoutComponent {
    constructor(private authService: AuthService) {}

    onLogout() {
        this.authService
            .logout()
            .pipe(
                catchError((error) => {
                    // Handle logout error
                    console.error(error);
                    return of(null); // Return an observable with a null value
                })
            )
            .subscribe({
                next: (response) => {
                    // Handle successful logout
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
