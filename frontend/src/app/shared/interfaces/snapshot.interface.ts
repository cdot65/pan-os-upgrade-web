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

export interface ArpTableEntry {
    interface: string;
    ip: string;
    mac: string;
    port: string;
    status: string;
    ttl: number;
}

export interface Route {
    virtual_router: string;
    destination: string;
    nexthop: string;
    metric: number;
    flags: string;
    age: number | null;
    interface: string | null;
    route_table: string;
}

export interface SessionStats {
    age_accel_thresh: number;
    age_accel_tsf: number;
    age_scan_ssf: number;
    age_scan_thresh: number;
    age_scan_tmo: number;
    cps: number;
    dis_def: number;
    dis_sctp: number;
    dis_tcp: number;
    dis_udp: number;
    icmp_unreachable_rate: number;
    kbps: number;
    max_pending_mcast: number;
    num_active: number;
    num_bcast: number;
    num_gtpc: number;
    num_gtpu_active: number;
    num_gtpu_pending: number;
    num_http2_5gc: number;
    num_icmp: number;
    num_imsi: number;
    num_installed: number;
    num_max: number;
    num_mcast: number;
    num_pfcpc: number;
    num_predict: number;
    num_sctp_assoc: number;
    num_sctp_sess: number;
    num_tcp: number;
    num_udp: number;
    pps: number;
    tcp_cong_ctrl: number;
    tcp_reject_siw_thresh: number;
    tmo_5gcdelete: number;
    tmo_cp: number;
    tmo_def: number;
    tmo_icmp: number;
    tmo_sctp: number;
    tmo_sctpcookie: number;
    tmo_sctpinit: number;
    tmo_sctpshutdown: number;
    tmo_tcp: number;
    tmo_tcp_delayed_ack: number;
    tmo_tcp_unverif_rst: number;
    tmo_tcphalfclosed: number;
    tmo_tcphandshake: number;
    tmo_tcpinit: number;
    tmo_tcptimewait: number;
    tmo_udp: number;
    vardata_rate: number;
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
    arp_table_entries: ArpTableEntry[];
    routes: Route[];
    session_stats?: SessionStats[];
}
