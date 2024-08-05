/* eslint-disable @typescript-eslint/naming-convention */

// src/app/snapshots/services/snapshot-processor.service.ts

import { Injectable } from "@angular/core";
import {
    ArpTableEntry,
    ContentVersion,
    License,
    NetworkInterface,
    Route,
    SessionStats,
    Snapshot,
} from "../../shared/interfaces/snapshot.interface";

@Injectable({
    providedIn: "root",
})
export class SnapshotProcessorService {
    processSnapshot(snapshot: Snapshot): Snapshot {
        return {
            ...snapshot,
            content_versions: this.sortContentVersions(
                snapshot.content_versions,
            ),
            licenses: this.sortLicenses(snapshot.licenses),
            network_interfaces: this.sortNetworkInterfaces(
                snapshot.network_interfaces,
            ),
            arp_table_entries: this.sortArpTableEntries(
                snapshot.arp_table_entries,
            ),
            routes: this.sortRoutes(snapshot.routes),
        };
    }

    sortContentVersions(versions: ContentVersion[]): ContentVersion[] {
        return versions.sort((a, b) => a.version.localeCompare(b.version));
    }

    sortLicenses(licenses: License[]): License[] {
        return licenses.sort((a, b) => a.feature.localeCompare(b.feature));
    }

    sortNetworkInterfaces(interfaces: NetworkInterface[]): NetworkInterface[] {
        return interfaces.sort((a, b) => a.name.localeCompare(b.name));
    }

    sortArpTableEntries(entries: ArpTableEntry[]): ArpTableEntry[] {
        return entries.sort((a, b) => a.ip.localeCompare(b.ip));
    }

    sortRoutes(routes: Route[]): Route[] {
        return routes.sort((a, b) =>
            a.destination.localeCompare(b.destination),
        );
    }

    prepareChartData(stats: SessionStats | undefined): {
        sessionCountsData: any[];
        sessionRatesData: any[];
        timeoutData: any[];
    } {
        if (!stats) {
            return {
                sessionCountsData: [],
                sessionRatesData: [],
                timeoutData: [],
            };
        }

        const sessionCountsData = [
            { name: "Active", value: stats.num_active || 0 },
            { name: "TCP", value: stats.num_tcp || 0 },
            { name: "UDP", value: stats.num_udp || 0 },
            { name: "ICMP", value: stats.num_icmp || 0 },
        ];

        const sessionRatesData = [
            { name: "CPS", value: stats.cps || 0 },
            { name: "PPS", value: stats.pps || 0 },
            { name: "KBPS", value: stats.kbps || 0 },
        ];

        const timeoutData = [
            { name: "TCP", value: stats.tmo_tcp || 0 },
            { name: "UDP", value: stats.tmo_udp || 0 },
            { name: "ICMP", value: stats.tmo_icmp || 0 },
        ];

        return { sessionCountsData, sessionRatesData, timeoutData };
    }
}
