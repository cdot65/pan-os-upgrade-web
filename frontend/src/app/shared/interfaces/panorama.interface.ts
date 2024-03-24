// frontend/src/app/shared/interfaces/panorama.interface.ts

export interface Panorama {
    apiKey: string;
    hostname: string;
    ipv4Address: string;
    ipv6Address: string;
    notes: string;
    platform: PanoramaPlatform;
    uuid: string;
}

export interface PanoramaPlatform {
    name: string;
}
