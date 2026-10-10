import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { formatClock } from "@/lib/data/reportFormat";
import type { Report } from "@/lib/db/types";

export function PendingReportsCard({
  pending,
  totalPending,
  totalReports,
  onReview,
  onResetSample,
  resetting,
  sample = false,
}: {
  pending: Report[];
  totalPending: number;
  totalReports: number;
  onReview: (report: Report) => void;
  onResetSample: () => void;
  resetting: boolean;
  sample?: boolean;
}) {
  return (
    <Card className="flex h-full flex-col gap-3 border-t-4 border-t-amber-border py-4 px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-border motion-safe:animate-pulse"
            aria-hidden="true"
          />
          <CardTitle>Pending purchase orders</CardTitle>
          <span className="rounded-full bg-amber-bg px-2 py-0.5 font-mono text-xs font-semibold text-amber-text">
            {totalPending}
          </span>
          {sample ? <Tag tone="dashed">Sample data</Tag> : null}
        </div>
        <Link href="/settings" className="text-sm font-semibold text-navy">
          Automation settings
        </Link>
      </div>

      {pending.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          All clear. Nothing is waiting.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th
                  scope="col"
                  className="px-2 py-1 text-left font-mono text-xs font-medium tracking-wide text-muted uppercase"
                >
                  Report
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 text-left font-mono text-xs font-medium tracking-wide text-muted uppercase"
                >
                  To
                </th>
                <th
                  scope="col"
                  className="px-2 py-1 text-left font-mono text-xs font-medium tracking-wide text-muted uppercase"
                >
                  Since
                </th>
                <th scope="col" className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr
                  key={r.report_id}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-2 py-1 align-top font-semibold">
                    {r.title}
                  </td>
                  <td className="px-2 py-1 align-top">{r.recipient}</td>
                  <td className="px-2 py-1 align-top font-mono">
                    {formatClock(r.generated_at)}
                  </td>
                  <td className="px-2 py-1 align-top">
                    <Button variant="primary" onClick={() => onReview(r)}>
                      Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {pending.length === 0
            ? "Nothing waiting"
            : `All ${pending.length} waiting shown`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={onResetSample}
            disabled={resetting || sample}
            title={
              sample ? "Run the pending migration to enable this" : undefined
            }
          >
            {resetting ? "Resetting…" : "Reset sample"}
          </Button>
          <Link href="/warnings" className={buttonClasses("secondary")}>
            View all {totalReports}
          </Link>
        </div>
      </div>
    </Card>
  );
}
