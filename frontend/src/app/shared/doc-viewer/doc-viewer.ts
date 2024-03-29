import {
    ApplicationRef,
    Component,
    ComponentFactoryResolver,
    ElementRef,
    EventEmitter,
    Injectable,
    Injector,
    Input,
    NgZone,
    OnDestroy,
    Output,
    SecurityContext,
    ViewContainerRef,
} from "@angular/core";
import { ComponentPortal, DomPortalOutlet } from "@angular/cdk/portal";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Observable, Subscription } from "rxjs";
import { shareReplay, take, tap } from "rxjs/operators";

import { DomSanitizer } from "@angular/platform-browser";
import { HeaderLink } from "./header-link";

@Injectable({ providedIn: "root" })
class DocFetcher {
    private _cache: Record<string, Observable<string>> = {};

    constructor(private _http: HttpClient) {}

    fetchDocument(url: string): Observable<string> {
        if (this._cache[url]) {
            return this._cache[url];
        }

        const stream = this._http
            .get(url, { responseType: "text" })
            .pipe(shareReplay(1));
        return stream.pipe(tap(() => (this._cache[url] = stream)));
    }
}

@Component({
    selector: "doc-viewer",
    template: "Loading document...",
    standalone: true,
})
export class DocViewer implements OnDestroy {
    private _portalHosts: DomPortalOutlet[] = [];
    private _documentFetchSubscription: Subscription | undefined;

    @Input() name: string | undefined;

    /** The URL of the document to display. */
    @Input()
    set documentUrl(url: string | undefined) {
        if (url !== undefined) {
            this._fetchDocument(url);
        }
    }

    @Output() contentRendered = new EventEmitter<HTMLElement>();

    /** The document text. It should not be HTML encoded. */
    textContent = "";

    constructor(
        private _appRef: ApplicationRef,
        private _componentFactoryResolver: ComponentFactoryResolver,
        public _elementRef: ElementRef,
        private _injector: Injector,
        private _viewContainerRef: ViewContainerRef,
        private _ngZone: NgZone,
        private _domSanitizer: DomSanitizer,
        private _docFetcher: DocFetcher,
    ) {}

    /** Fetch a document by URL. */
    private _fetchDocument(url: string) {
        this._documentFetchSubscription?.unsubscribe();
        this._documentFetchSubscription = this._docFetcher
            .fetchDocument(url)
            .subscribe(
                (document) => this.updateDocument(document),
                (error) => this.showError(url, error),
            );
    }

    /**
     * Updates the displayed document.
     * @param rawDocument The raw document content to show.
     */
    private updateDocument(rawDocument: string) {
        // "/components/button/api#my-section". This is necessary because otherwise these fragment
        // links would redirect to "/#my-section".
        rawDocument = rawDocument.replace(
            /href="#([^"]*)"/g,
            (_m: string, fragmentUrl: string) => {
                const absoluteUrl = `${location.pathname}#${fragmentUrl}`;
                return `href="${this._domSanitizer.sanitize(SecurityContext.URL, absoluteUrl)}"`;
            },
        );
        this._elementRef.nativeElement.innerHTML = rawDocument;
        this.textContent = this._elementRef.nativeElement.textContent;
        this._loadComponents("header-link", HeaderLink);

        // Resolving and creating components dynamically in Angular happens synchronously, but since
        // we want to emit the output if the components are actually rendered completely, we wait
        // until the Angular zone becomes stable.
        this._ngZone.onStable
            .pipe(take(1))
            .subscribe(() =>
                this.contentRendered.next(this._elementRef.nativeElement),
            );
    }

    /** Show an error that occurred when fetching a document. */
    private showError(url: string, error: HttpErrorResponse) {
        console.error(error);
        this._elementRef.nativeElement.innerText = `document: ${url}. Error: ${error.statusText}`;
    }

    /** Instantiate a HeaderLink for each header. */
    private _loadComponents(componentName: string, componentClass: any) {
        const headerElements = this._elementRef.nativeElement.querySelectorAll(
            `[${componentName}]`,
        );

        [...headerElements].forEach((element: Element) => {
            const portalHost = new DomPortalOutlet(
                element,
                this._componentFactoryResolver,
                this._appRef,
                this._injector,
            );
            const headerPortal = new ComponentPortal(
                componentClass,
                this._viewContainerRef,
            );
            portalHost.attach(headerPortal);
            this._portalHosts.push(portalHost);
        });
    }

    private _clearPortalHosts() {
        this._portalHosts.forEach((h) => h.dispose());
        this._portalHosts = [];
    }

    ngOnDestroy() {
        this._clearPortalHosts();
        this._documentFetchSubscription?.unsubscribe();
    }
}
