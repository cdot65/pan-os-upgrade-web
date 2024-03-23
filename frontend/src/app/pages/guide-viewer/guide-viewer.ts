import { ActivatedRoute, Router, RouterModule, Routes } from "@angular/router";
import { Component, HostBinding, NgModule, OnInit } from "@angular/core";
import { GuideItem, GuideItems } from "../../shared/guide-items/guide-items";

import { ComponentPageTitle } from "../page-title/page-title";
import { DocViewer } from "../../shared/doc-viewer/doc-viewer";
import { DocViewerModule } from "../../shared/doc-viewer/doc-viewer-module";
import { Footer } from "../../shared/footer/footer";
import { NavigationFocus } from "../../shared/navigation-focus/navigation-focus";
import { ReactiveFormsModule } from "@angular/forms";
import { TableOfContents } from "../../shared/table-of-contents/table-of-contents";

@Component({
    selector: "guide-viewer",
    templateUrl: "./guide-viewer.html",
    styleUrls: ["./guide-viewer.scss"],
    standalone: true,
    imports: [DocViewer, NavigationFocus, TableOfContents, Footer],
})
export class GuideViewer implements OnInit {
    @HostBinding("class.main-content") readonly mainContentClass = true;
    guide: GuideItem | undefined;

    constructor(
        _route: ActivatedRoute,
        private _componentPageTitle: ComponentPageTitle,
        private router: Router,
        public guideItems: GuideItems,
    ) {
        _route.params.subscribe((p) => {
            const guideItem = guideItems.getItemById(p["id"]);
            if (guideItem) {
                this.guide = guideItem;
            }

            if (!this.guide) {
                this.router.navigate(["/guides"]);
            }
        });
    }

    ngOnInit(): void {
        if (this.guide !== undefined) {
            this._componentPageTitle.title = this.guide.name;
        }
    }
}

const routes: Routes = [{ path: "", component: GuideViewer }];

// This module needs to include all of the modules required by the examples in the guides.
// For example, the custom form-field guide requires the ReactiveFormsModule.
// These imports may need to be updated when adding examples to new or existing guides.
@NgModule({
    imports: [DocViewerModule, ReactiveFormsModule, RouterModule.forChild(routes), GuideViewer],
    exports: [GuideViewer],
})
export class GuideViewerModule {}
