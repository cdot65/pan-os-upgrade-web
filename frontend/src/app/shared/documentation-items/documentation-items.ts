import { Injectable } from "@angular/core";

export interface AdditionalApiDoc {
    name: string;
    path: string;
}

export interface ExampleSpecs {
    prefix: string;
    exclude?: string[];
}

export interface DocItem {
    id: string;
    name: string;
    summary?: string;
    packageName?: string;
    apiDocId?: string;
    overviewPath?: string;
    additionalApiDocs?: AdditionalApiDoc[];
}

export interface DocSection {
    name: string;
    summary: string;
}

const CDK = "cdk";
const COMPONENTS = "components";
const INVENTORY = "inventory";

export const SECTIONS: { [key: string]: DocSection } = {
    [COMPONENTS]: {
        name: "Components",
        summary:
            "Angular Material offers a wide variety of UI components based on the <a" +
            ' href="https://material.io/components">Material Design specification</a>',
    },
    [CDK]: {
        name: "CDK",
        summary:
            "The Component Dev Kit (CDK) is a set of behavior primitives for building UI" +
            " components.",
    },
    [INVENTORY]: {
        name: "Inventory",
        summary:
            "Manage your environments inventory of Palo Alto Networks firewalls and" +
            " Panorama appliances.",
    },
};

const DOCS: { [key: string]: DocItem[] } = {
    [COMPONENTS]: [
        {
            id: "autocomplete",
            name: "Autocomplete",
            summary: "Suggests relevant options as the user types.",
            additionalApiDocs: [
                { name: "Testing", path: "material-autocomplete-testing.html" },
            ],
        },
        {
            id: "tree",
            name: "Tree",
            summary: "Presents hierarchical content as an expandable tree.",
        },
    ],
    [CDK]: [
        {
            id: "a11y",
            name: "Accessibility",
            summary: "Utilities for screen readers, focus and more.",
        },
        {
            id: "tree",
            name: "Tree",
            summary: "Presents hierarchical content as an expandable tree.",
        },
    ],
};

const ALL_COMPONENTS = processDocs("material", DOCS[COMPONENTS]);
const ALL_CDK = processDocs("cdk", DOCS[CDK]);
const ALL_DOCS = [...ALL_COMPONENTS, ...ALL_CDK];

@Injectable({ providedIn: "root" })
export class DocumentationItems {
    getItems(section: string): DocItem[] {
        if (section === COMPONENTS) {
            return ALL_COMPONENTS;
        }
        if (section === CDK) {
            return ALL_CDK;
        }
        return [];
    }

    getItemById(id: string, section: string): DocItem | undefined {
        const sectionLookup = section === "cdk" ? "cdk" : "material";
        return ALL_DOCS.find(
            (doc) => doc.id === id && doc.packageName === sectionLookup,
        );
    }
}

function processDocs(packageName: string, docs: DocItem[]): DocItem[] {
    for (const doc of docs) {
        doc.packageName = packageName;
    }

    return docs.sort((a, b) => a.name.localeCompare(b.name, "en"));
}
