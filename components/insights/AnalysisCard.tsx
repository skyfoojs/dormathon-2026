import { Card, CardBody, CardTitle } from "@/components/ui/Card";
import { ProvenanceTag, type ProvenanceKind } from "@/components/ui/Tag";

export function AnalysisCard({
  question,
  caption,
  takeawayLead,
  takeawayRest,
  provenance,
  summary,
  children,
}: {
  question: string;
  caption: string;
  takeawayLead: string;
  takeawayRest: string;
  provenance: ProvenanceKind[];
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-6">
      <div className="flex flex-col gap-1">
        <CardTitle>{question}</CardTitle>
        <p className="text-sm text-muted">{caption}</p>
      </div>
      <CardBody>
        <div role="img" aria-label={summary}>
          {children}
        </div>
        <p className="sr-only">{summary}</p>
        <p className="text-sm">
          <span className="font-semibold">{takeawayLead} </span>
          {takeawayRest}
        </p>
        <div className="flex flex-wrap gap-2">
          {provenance.map((p) => (
            <ProvenanceTag key={p} kind={p} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
