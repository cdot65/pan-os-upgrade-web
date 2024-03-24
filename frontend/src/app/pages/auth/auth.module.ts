// src/app/pages/auth/auth.module.ts

import { AuthRoutingModule } from "./auth-routing.module";
import { HttpClientModule } from "@angular/common/http";
import { MatCardModule } from "@angular/material/card";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

@NgModule({
    imports: [RouterModule, AuthRoutingModule, HttpClientModule, MatCardModule],
})
export class AuthModule {}
