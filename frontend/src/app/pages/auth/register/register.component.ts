// src/app/pages/auth/register/register.component.ts

import { FormsModule, NgForm } from "@angular/forms";

import { AuthService } from "../../../shared/services/auth.service";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

@Component({
    selector: "app-register",
    templateUrl: "./register.component.html",
    styleUrls: ["./register.component.scss"],
    standalone: true,
    imports: [CommonModule, FormsModule],
})
export class RegisterComponent {
    username: string = "";
    email: string = "";
    password1: string = "";
    password2: string = "";

    constructor(
        private authService: AuthService,
        private router: Router,
    ) {}

    onSubmit(form: NgForm) {
        const { username, email, password1, password2 } = form.value;
        this.authService
            .register(username, email, password1, password2)
            .subscribe({
                next: () => {
                    this.router.navigate(["/auth/login"]);
                },
                error: (error) => {
                    console.error("Registration error:", error);
                },
            });
    }
}
