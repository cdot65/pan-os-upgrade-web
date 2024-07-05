/* eslint-disable @typescript-eslint/naming-convention */

// src/app/shared/interfaces/snapshot.interface.ts
export interface ContentVersion {
    version: string;
}

export interface License {
    feature: string;
    description: string;
    serial: string;
    issued: string;
    expires: string;
    expired: string;
    base_license_name: string;
    authcode: string | null;
    custom: { [key: string]: string } | null;
}

export interface NetworkInterface {
    name: string;
    status: string;
}

export interface Snapshot {
    uuid: string;
    created_at: string;
    snapshot_type: "pre" | "post";
    job: string;
    device: string;
    device_hostname: string;
    content_versions: ContentVersion[];
    licenses: License[];
    network_interfaces: NetworkInterface[];
}
