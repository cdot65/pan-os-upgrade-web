/* eslint-disable @typescript-eslint/naming-convention */

// src/app/shared/interfaces/panos-version.interface.ts

export interface PanosVersion {
    id: number;
    version: string;
    release_date: string | null;
    end_of_life_date: string | null;
    notes: string | null;
    filename: string | null;
    size: string | null;
    size_kb: string | null;
    released_on: string | null;
    release_notes: string | null;
    downloaded: boolean;
    current: boolean;
    latest: boolean;
    uploaded: boolean;
    sha256: string | null;
}
