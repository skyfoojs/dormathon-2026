import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProvenanceTag, Tag, type TagTone } from "@/components/ui/Tag";
import type { PredictionRunDetail, RunChangeRow, RunSourceRow } from "@/lib/mock/predictionDetail";

const STATUS_TONE: Record<RunSourceRow["status"], TagTone> = {
  Read: "green",
  Failed: "red",
  Stale: "amber",
};

const CHANGE_TONE: Record<RunChangeRow["type"], TagTone> = {
  "No change": "grey",
  Input: "violet",
  Raised: "red",
  Cleared: "green",
  Stale: "amber",
};

export function SourcesAndChanges({ detail }: { detail: PredictionRunDetail }) {
  return (
    <div className="flex flex-wrap gap-5">
      <Card className="min-w-80 flex-1 p-5">
        <CardHeader>
          <CardTitle>Sources read</CardTitle>
        </CardHeader>
        <CardBody className="mt-3">
          {detail.sources.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="text-sm">{s.name}</span>
                <ProvenanceTag kind={s.provenance} />
              </div>
              <Tag tone={STATUS_TONE[s.status]}>{s.status}</Tag>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card className="min-w-80 flex-1 p-5">
        <CardHeader>
          <CardTitle>What changed since the previous run</CardTitle>
        </CardHeader>
        <CardBody className="mt-3">
          {detail.changes.map((c, i) => (
            <div key={i} className="flex items-start gap-3 border-b border-line pb-2 last:border-0 last:pb-0">
              <Tag tone={CHANGE_TONE[c.type]} className="mt-0.5 shrink-0">
                {c.type}
              </Tag>
              <span className="text-sm">{c.text}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
