import { Card, CardTitle } from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { FlowChart } from "@/components/ui/FlowChart";
import type { FaqEntry } from "@/lib/data/faq";

export function FaqCard({ entry }: { entry: FaqEntry }) {
  const headingId = `faq-${entry.id}`;
  const Icon = entry.icon;

  return (
    <Card as="section" aria-labelledby={headingId} className="flex flex-col gap-5 p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-tint text-navy">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="flex max-w-3xl flex-col gap-1">
          <CardTitle>
            <span id={headingId}>{entry.question}</span>
          </CardTitle>
          <p className="text-base text-strong-muted">{entry.summary}</p>
        </div>
      </div>

      <FlowChart stages={entry.flow} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-md border border-blue-border bg-blue-tint p-4">
          <Eyebrow as="h3" className="text-navy">
            Example
          </Eyebrow>
          <p className="text-sm text-ink">{entry.example}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Eyebrow as="h3">Good to know</Eyebrow>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-strong-muted">
            {entry.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
