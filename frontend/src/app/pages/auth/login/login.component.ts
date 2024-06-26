// src/app/pages/auth/login/login.component.ts

import { FormsModule, NgForm } from "@angular/forms";

import { AuthService } from "../../../shared/services/auth.service";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { Router } from "@angular/router";

@Component({
    selector: "app-login",
    templateUrl: "./login.component.html",
    styleUrls: ["./login.component.scss"],
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
    ],
})
export class LoginComponent {
    username: string = "";
    password: string = "";
    errorMessage: string = "";

    constructor(
        private router: Router,
        private authService: AuthService,
    ) {}

    onSubmit(form: NgForm) {
        this.errorMessage = "";

        const { username, password } = form.value;
        this.authService.login(username, password).subscribe({
            next: () => {
                this.router.navigate(["/"]);
            },
            error: () => {
                this.errorMessage = "Invalid username or password";
            },
        });
    }
}
