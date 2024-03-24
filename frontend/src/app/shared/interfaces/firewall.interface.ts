// frontend/src/app/shared/interfaces/firewall.interface.ts

export interface Firewall {
    apiKey: string;
    hostname: string;
    ipv4Address: string;
    ipv6Address: string;
    notes: string;
    platform: FirewallPlatform;
    uuid: string;
}

export interface FirewallPlatform {
    name: string;
}
