// src/app/pages/firewall-diagram/firewall-diagram.config.ts

// eslint-disable-next-line @typescript-eslint/naming-convention
export const FirewallDiagramConfig = {
    imagePaths: {
        firewallSecondary: "assets/img/site/firewall_secondary.svg",
        firewallPrimary: "assets/img/site/firewall.svg",
        statusCompleted: "assets/img/site/check.svg",
        statusErrored: "assets/img/site/failed.svg",
        statusInProgress: "assets/img/site/spin.svg",
    },
    haStates: {
        active: ["active", "active-primary"],
        passive: ["passive", "active-secondary"],
    },
    cssClasses: {
        haActive: "ha-active",
        haPassive: "ha-passive",
        standalone: "standalone",
    },
};
