import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProvenanceTag } from "@/components/ui/Tag";
import type { ExternalSignalRow } from "@/lib/data/dashboard";

export function ExternalSignalsCard({ signals }: { signals: ExternalSignalRow[] }) {
  return (
    <Card className="flex w-full flex-col gap-3.5 p-6 md:w-80 md:shrink-0">
      <CardHeader>
        <CardTitle>External signals</CardTitle>
      </CardHeader>
      <CardBody className="gap-4">
        {signals.map((s) => (
          <div key={s.name} className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{s.name}</span>
              <ProvenanceTag kind={s.provenance} />
            </div>
            <div className="font-mono text-lg font-medium">{s.value}</div>
            <div className="text-xs text-muted">{s.trend}</div>
          </div>
        ))}
        <Link href="/predictions" className="text-sm font-semibold text-navy">
          See how these feed predictions
        </Link>
      </CardBody>
    </Card>
  );
}
