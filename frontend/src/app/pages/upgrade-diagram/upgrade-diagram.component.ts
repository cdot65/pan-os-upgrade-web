// src/app/pages/upgrade-diagram/upgrade-diagram.component.ts
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { UpgradeStepService } from "../../shared/services/upgrade-step.service";

@Component({
    selector: "app-upgrade-diagram",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./upgrade-diagram.component.html",
    styleUrls: ["./upgrade-diagram.component.scss"],
})
export class UpgradeDiagramComponent {
    currentStepSvgPath$ = this.upgradeStepService.getCurrentStepSvgPath();

    constructor(private upgradeStepService: UpgradeStepService) {}
}
