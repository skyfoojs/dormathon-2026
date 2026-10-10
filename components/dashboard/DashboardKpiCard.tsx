import { Card } from "@/components/ui/Card";
import { ProvenanceTag, type ProvenanceKind } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import type { KpiTheme } from "@/lib/data/kpiStyle";

// Dashboard-only KPI card (icon tile, coloured top edge, tinted background)
// per dashboard-revamp/DASHBOARD_CHANGES_PROMPT.md. Kept separate from the
// shared KpiCard component, which Insights also uses with a different,
// simpler anatomy that must not change.
export function DashboardKpiCard({
  label,
  provenance,
  value,
  sub,
  iconPath,
  theme,
  delayMs = 0,
}: {
  label: string;
  provenance: ProvenanceKind;
  value: string;
  sub: string;
  iconPath: string;
  theme: KpiTheme;
  delayMs?: number;
}) {
  return (
    <Card
      className={cn(
        "kpi-rise shadow-sm transition duration-200 hover:-translate-y-0.75 hover:shadow-md flex min-w-0 flex-col gap-1 border-t-4 px-4.5 py-3",
        theme.topEdge,
        theme.tint,
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center justify-between gap-2.5">
        <span className="font-mono text-xs font-medium tracking-wide text-muted uppercase">
          {label}
        </span>
        <span
          className={cn(
            "flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-card border bg-card",
            theme.tileBorder,
            theme.tileText,
          )}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={iconPath} />
          </svg>
        </span>
      </div>
      <div className={cn("font-mono text-4xl leading-none font-medium", theme.valueText)}>{value}</div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={cn("text-sm font-semibold", theme.subText)}>{sub}</span>
        <ProvenanceTag kind={provenance} />
      </div>
    </Card>
  );
}
