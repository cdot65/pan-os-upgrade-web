import { Component } from "@angular/core";
import packageJson from "../../../../package.json";

@Component({
    selector: "app-footer",
    templateUrl: "./footer.html",
    styleUrls: ["./footer.scss"],
    standalone: true,
})
export class Footer {
    public version: string = packageJson.version;
    year = new Date().getFullYear();
}
