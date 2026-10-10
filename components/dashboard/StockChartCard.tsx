import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProvenanceTag } from "@/components/ui/Tag";
import type { StockChartData } from "@/lib/data/dashboard";
import { StockChart } from "@/components/dashboard/StockChart";
import { HazeBarStrip } from "@/components/dashboard/HazeBarStrip";

const LEGEND_ITEMS = [
  { label: "Closing stock", swatch: "border-t-2 border-navy" },
  { label: "Forecast", swatch: "border-t-2 border-blue-light" },
  { label: "P10 to P90", swatch: "h-3 border border-blue-border bg-blue-tint" },
  { label: "Reorder level", swatch: "border-t-2 border-dashed border-red" },
];

export function StockChartCard({ data }: { data: StockChartData | null }) {
  return (
    <Card className="flex min-w-80 flex-1 flex-col gap-3.5 p-6">
      <CardHeader>
        <CardTitle>
          {data ? `${data.itemName}: weekly stock` : "Weekly stock"}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3.5 text-xs text-strong-muted">
          {LEGEND_ITEMS.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={`inline-block w-5 ${l.swatch}`} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
      </CardHeader>

      {data ? (
        <CardBody>
          <StockChart data={data} />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <ProvenanceTag kind="database" />
            <ProvenanceTag kind="model-output" />
            <span>
              Forecast is a trend projection from the last 8 weeks of closing
              stock, with a P10 to P90 band from the week-to-week spread.
              Illustrative, not a trained model.
            </span>
          </div>
          <HazeBarStrip bars={data.hazeBars} />
        </CardBody>
      ) : (
        <div className="rounded-md bg-page p-12 text-center text-muted">
          No sample rows for this facility. The mockup has weekly stock for
          Hospital Kuala Lumpur only.
        </div>
      )}
    </Card>
  );
}
