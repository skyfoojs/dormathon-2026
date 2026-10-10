import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { SeverityPill } from "@/components/ui/SeverityPill";
import type { WarningRecord } from "@/lib/data/warnings";

const SEVERITY_RANK: Record<WarningRecord["severity"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function TopWarningsCard({
  warnings,
  totalOpenCount,
}: {
  warnings: WarningRecord[];
  totalOpenCount: number;
}) {
  const top = [...warnings]
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    .slice(0, 3);

  return (
    <Card className="flex min-w-80 flex-1 flex-col gap-3.5 p-6">
      <CardHeader>
        <CardTitle>Top warnings</CardTitle>
        <Link href="/warnings" className="text-sm font-semibold text-navy">
          View all {totalOpenCount}
        </Link>
      </CardHeader>
      <CardBody>
        {top.length === 0 ? (
          <p className="text-sm text-muted">Nothing to resolve right now.</p>
        ) : (
          top.map((w) => (
            <div key={w.id} className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <SeverityPill severity={w.severity} />
              </div>
              <div className="text-sm font-semibold">{w.title}</div>
              <div className="text-xs text-muted">{w.detail}</div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
