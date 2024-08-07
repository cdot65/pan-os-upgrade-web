// src/app/snapshots/snapshot-list/snapshot-list.config.ts

import { Color, ScaleType } from "@swimlane/ngx-charts";

export const snapshotListConfig = {
    view: [700, 400] as [number, number],
    showXAxis: true,
    showYAxis: true,
    gradient: false,
    showLegend: true,
    showXAxisLabel: true,
    showYAxisLabel: true,
    xAxisLabel: "Type",
    yAxisLabel: "Value",
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
};
