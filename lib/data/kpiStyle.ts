// Per-card visual theme for the Dashboard's 4 KPI cards, per
// docs' DASHBOARD_CHANGES_PROMPT.md. Each value is a complete, static
// Tailwind class string (not built by template-concatenation) so the
// Tailwind compiler can see and generate it.
export type KpiTheme = {
  topEdge: string;
  tileBorder: string;
  tileText: string;
  valueText: string;
  subText: string;
  tint: string;
};

export const KPI_THEME: Record<"air" | "po" | "stock", KpiTheme> = {
  air: {
    topEdge: "border-t-amber-border",
    tileBorder: "border-amber-border/27",
    tileText: "text-amber-border",
    valueText: "text-kpi-air-text",
    subText: "text-kpi-air-text",
    tint: "bg-kpi-air-tint",
  },
  po: {
    topEdge: "border-t-kpi-po-accent",
    tileBorder: "border-kpi-po-accent/27",
    tileText: "text-kpi-po-accent",
    valueText: "text-green-text",
    subText: "text-green-text",
    tint: "bg-kpi-po-tint",
  },
  stock: {
    topEdge: "border-t-navy",
    tileBorder: "border-navy/27",
    tileText: "text-navy",
    valueText: "text-navy",
    subText: "text-navy",
    tint: "bg-kpi-stock-tint",
  },
};

// Accuracy bands: >=90 green, 80-89.9 amber, <80 red.
export function accuracyTheme(accuracy: number): KpiTheme {
  if (accuracy >= 90) {
    return {
      topEdge: "border-t-kpi-band-green-edge",
      tileBorder: "border-kpi-band-green-edge/27",
      tileText: "text-kpi-band-green-edge",
      valueText: "text-green-text",
      subText: "text-green-text",
      tint: "bg-kpi-po-tint",
    };
  }
  if (accuracy >= 80) {
    return {
      topEdge: "border-t-amber-border",
      tileBorder: "border-amber-border/27",
      tileText: "text-amber-border",
      valueText: "text-kpi-air-text",
      subText: "text-kpi-air-text",
      tint: "bg-kpi-band-amber-tint",
    };
  }
  return {
    topEdge: "border-t-red",
    tileBorder: "border-red/27",
    tileText: "text-red",
    valueText: "text-red-dark",
    subText: "text-red-dark",
    tint: "bg-kpi-band-red-tint",
  };
}

export const NO_DATA_THEME: KpiTheme = {
  topEdge: "border-t-calc-border",
  tileBorder: "border-calc-border/27",
  tileText: "text-calc-border",
  valueText: "text-muted",
  subText: "text-muted",
  tint: "bg-card",
};

// Literal 24x24 stroke-icon path data, per the spec's icon column (not a
// lucide glyph - these are custom shapes with no lucide equivalent).
export const KPI_ICON_PATHS = {
  air: "M3 8h11a3 3 0 100-3M3 12h15a3 3 0 11-3 3M3 16h7",
  po: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
  accuracy: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z",
  stock: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
} as const;
