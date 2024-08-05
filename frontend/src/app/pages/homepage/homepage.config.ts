// src/app/pages/homepage/homepage.config.ts

import { Color, ScaleType } from "@swimlane/ngx-charts";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const HomepageConfig = {
    pageTitle: "Dashboard",
    breadcrumbs: [
        { label: "Home", url: "/" },
        { label: "Dashboard", url: "/" },
    ],
    pageDescription: "Overview of PAN-OS upgrades and statistics",

    chartConfig: {
        view: [700, 400] as [number, number],
        gradient: true,
        colorScheme: {
            name: "custom",
            selectable: true,
            group: ScaleType.Ordinal,
            domain: [
                "#04B3D9",
                "#AE6321",
                "#D96704",
                "#248FA6",
                "#84562F",
                "#306773",
                "#59422E",
                "#283B40",
                "#332A23",
                "#2A3133",
                "#D9D0C3",
                "#C2DCF2",
                "#FFE1B3",
                "#A2D3FF",
                "#FFCE80",
                "#735D39",
                "#303D48",
                "#395873",
                "#40382D",
                "#A6B8C8",
            ],
        } as Color,
    },

    appVersionChartConfig: {
        view: [700, 400] as [number, number],
        legendTitle: "App-ID Version",
        showLegend: true,
        showXAxis: true,
        showYAxis: true,
        showXAxisLabel: true,
        showYAxisLabel: true,
        xAxisLabel: "Count",
        yAxisLabel: "Device Group",
    },

    jobChartConfig: {
        view: [700, 400] as [number, number],
        legendTitle: "Job Status",
        showLegend: true,
        showXAxis: true,
        showXAxisLabel: true,
        showYAxis: true,
        showYAxisLabel: true,
        xAxisLabel: "Count",
        yAxisLabel: "Job Type",
    },

    swVersionChartConfig: {
        view: [700, 400] as [number, number],
        legendTitle: "PAN-OS Version",
        showLegend: true,
        showXAxis: true,
        showYAxis: true,
        showXAxisLabel: true,
        showYAxisLabel: true,
        xAxisLabel: "Count",
        yAxisLabel: "Device Group",
    },
};
