/* eslint-disable @typescript-eslint/naming-convention */

// src/app/shared/interfaces/panos-version.interface.ts

export interface PanosVersion {
    id: number;
    version: string;
    release_date: string | null;
    end_of_life_date: string | null;
    notes: string | null;
}

export interface PanosVersionList {
    versions: string[];
}
