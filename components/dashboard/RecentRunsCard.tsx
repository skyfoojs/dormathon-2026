import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import type { PredictionRunSummary } from "@/lib/mock/predictionRuns";

export function RecentRunsCard({ runs }: { runs: PredictionRunSummary[] }) {
  return (
    <Card className="flex min-w-80 flex-1 flex-col gap-3.5 p-6">
      <CardHeader>
        <CardTitle>Recent prediction runs</CardTitle>
        <Link href="/predictions" className="text-sm font-semibold text-navy">
          All runs
        </Link>
      </CardHeader>
      <CardBody>
        {runs.length === 0 ? (
          <p className="text-sm text-muted">No runs yet for this facility.</p>
        ) : (
          runs.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-sm font-medium">{r.ranAtLabel}</span>
                <span className="text-xs text-muted">{r.trigger} trigger</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag tone={r.status === "OK" ? "blue" : "amber"}>{r.status}</Tag>
                <span className="font-mono text-sm text-strong-muted">{r.riskScore}/100</span>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
