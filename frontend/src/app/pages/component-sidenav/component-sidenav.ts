import {
    ActivatedRoute,
    Params,
    RouterLink,
    RouterLinkActive,
    RouterModule,
    RouterOutlet,
    Routes,
} from "@angular/router";
import { AsyncPipe, CommonModule, NgFor, NgIf } from "@angular/common";
import {
    Component,
    Input,
    NgModule,
    NgZone,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
    forwardRef,
} from "@angular/core";
import {
    ComponentApi,
    ComponentExamples,
    ComponentOverview,
    ComponentViewer,
    ComponentViewerModule,
} from "../component-viewer/component-viewer";
import {
    ComponentCategoryList,
    ComponentCategoryListModule,
} from "../component-category-list/component-category-list";
import {
    MatDrawerToggleResult,
    MatSidenav,
    MatSidenavModule,
} from "@angular/material/sidenav";
import { Observable, Subscription, combineLatest } from "rxjs";
import {
    animate,
    state,
    style,
    transition,
    trigger,
} from "@angular/animations";

import { BreakpointObserver } from "@angular/cdk/layout";
import { CdkAccordionModule } from "@angular/cdk/accordion";
import { ComponentPageHeader } from "../component-page-header/component-page-header";
import { DocViewerModule } from "../../shared/doc-viewer/doc-viewer-module";
import { DocumentationItems } from "../../shared/documentation-items/documentation-items";
import { Footer } from "../../shared/footer/footer";
import { FormsModule } from "@angular/forms";
import { HttpClientModule } from "@angular/common/http";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";
import { NavigationFocusService } from "../../shared/navigation-focus/navigation-focus.service";
import { map } from "rxjs/operators";

// These constants are used by the ComponentSidenav for orchestrating the MatSidenav in a responsive
// way. This includes hiding the sidenav, defaulting it to open, changing the mode from over to
// side, determining the size of the top gap, and whether the sidenav is fixed in the viewport.
// The values were determined through the combination of Material Design breakpoints and careful
// testing of the application across a range of common device widths (360px+).
// These breakpoint values need to stay in sync with the related Sass variables in
// src/styles/_constants.scss.
const EXTRA_SMALL_WIDTH_BREAKPOINT = 720;
const SMALL_WIDTH_BREAKPOINT = 959;

@Component({
    selector: "app-component-sidenav",
    templateUrl: "./component-sidenav.html",
    styleUrls: ["./component-sidenav.scss"],
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        MatSidenavModule,
        NgIf,
        forwardRef(() => ComponentNav),
        ComponentPageHeader,
        RouterOutlet,
        Footer,
        AsyncPipe,
    ],
})
export class ComponentSidenav implements OnInit, OnDestroy {
    @ViewChild(MatSidenav) sidenav!: MatSidenav;
    params: Observable<Params> | undefined;
    isExtraScreenSmall: Observable<boolean>;
    isScreenSmall: Observable<boolean>;
    private subscriptions = new Subscription();

    constructor(
        public docItems: DocumentationItems,
        private _route: ActivatedRoute,
        private _navigationFocusService: NavigationFocusService,
        zone: NgZone,
        breakpoints: BreakpointObserver
    ) {
        this.isExtraScreenSmall = breakpoints
            .observe(`(max-width: ${EXTRA_SMALL_WIDTH_BREAKPOINT}px)`)
            .pipe(map((breakpoint) => breakpoint.matches));
        this.isScreenSmall = breakpoints
            .observe(`(max-width: ${SMALL_WIDTH_BREAKPOINT}px)`)
            .pipe(map((breakpoint) => breakpoint.matches));
    }

    ngOnInit() {
        // Combine params from all of the path into a single object.
        this.params = combineLatest(
            this._route.pathFromRoot.map((route) => route.params),
            Object.assign
        );

        this.subscriptions.add(
            this._navigationFocusService.navigationEndEvents
                .pipe(map(() => this.isScreenSmall))
                .subscribe((shouldCloseSideNav) => {
                    if (shouldCloseSideNav && this.sidenav) {
                        this.sidenav.close();
                    }
                })
        );
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }

    toggleSidenav(sidenav: MatSidenav): Promise<MatDrawerToggleResult> {
        return sidenav.toggle();
    }
}

@Component({
    selector: "app-component-nav",
    templateUrl: "./component-nav.html",
    animations: [
        trigger("bodyExpansion", [
            state("collapsed", style({ height: "0px", display: "none" })),
            state("expanded", style({ height: "*", display: "block" })),
            transition(
                "expanded <=> collapsed",
                animate("225ms cubic-bezier(0.4,0.0,0.2,1)")
            ),
        ]),
    ],
    standalone: true,
    imports: [
        NgIf,
        MatListModule,
        NgFor,
        RouterLinkActive,
        RouterLink,
        AsyncPipe,
    ],
})
export class ComponentNav {
    @Input() params: Observable<Params> | undefined;
    currentItemId: string | undefined;

    constructor(public docItems: DocumentationItems) {}
}

const routes: Routes = [
    {
        path: "",
        component: ComponentSidenav,
        children: [
            { path: "component/:id", redirectTo: ":id", pathMatch: "full" },
            {
                path: "category/:id",
                redirectTo: "/categories/:id",
                pathMatch: "full",
            },
            {
                path: "categories",
                children: [{ path: "", component: ComponentCategoryList }],
            },
            {
                path: ":id",
                component: ComponentViewer,
                children: [
                    { path: "", redirectTo: "overview", pathMatch: "full" },
                    {
                        path: "overview",
                        component: ComponentOverview,
                        pathMatch: "full",
                    },
                    { path: "api", component: ComponentApi, pathMatch: "full" },
                    {
                        path: "examples",
                        component: ComponentExamples,
                        pathMatch: "full",
                    },
                ],
            },
            { path: "**", redirectTo: "/404" },
        ],
    },
];

@NgModule({
    imports: [
        MatSidenavModule,
        MatListModule,
        RouterModule,
        CommonModule,
        ComponentCategoryListModule,
        ComponentViewerModule,
        DocViewerModule,
        FormsModule,
        HttpClientModule,
        CdkAccordionModule,
        MatIconModule,
        RouterModule.forChild(routes),
        ComponentSidenav,
        ComponentNav,
    ],
    exports: [ComponentSidenav],
})
export class ComponentSidenavModule {}
