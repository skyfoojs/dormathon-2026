import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProvenanceTag, Tag, type TagTone } from "@/components/ui/Tag";
import type { RunChangeRow, RunSourceRow } from "@/lib/mock/predictionDetail";

const STATUS_TONE: Record<RunSourceRow["status"], TagTone> = {
  Read: "blue",
  Failed: "amber",
};

const CHANGE_TONE: Record<RunChangeRow["type"], TagTone> = {
  "No change": "grey",
  Input: "violet",
  Raised: "amber",
  Cleared: "blue",
  Stale: "amber",
};

export function SourcesAndChanges({ sources, changes }: { sources: RunSourceRow[]; changes: RunChangeRow[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card as="section" className="min-w-0 p-5">
        <CardHeader>
          <CardTitle>Sources read</CardTitle>
        </CardHeader>
        <CardBody as="ul" className="mt-3 gap-0 divide-y divide-line border-t border-line">
          {sources.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{s.name}</p>
                <p className="text-sm text-strong-muted">{s.note}</p>
              </div>
              <span className="flex flex-wrap gap-1.5">
                <ProvenanceTag kind={s.provenance} />
                <Tag tone={STATUS_TONE[s.status]}>{s.status}</Tag>
              </span>
            </li>
          ))}
        </CardBody>
      </Card>

      <Card as="section" className="min-w-0 p-5">
        <CardHeader>
          <CardTitle>What changed since the previous run</CardTitle>
        </CardHeader>
        <CardBody as="ul" className="mt-3 gap-0 divide-y divide-line border-t border-line">
          {changes.map((c) => (
            <li key={c.text} className="flex items-start gap-3 py-2.5">
              <Tag tone={CHANGE_TONE[c.type]} className="w-24 shrink-0 justify-center">
                {c.type}
              </Tag>
              <span className="text-sm">{c.text}</span>
            </li>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
