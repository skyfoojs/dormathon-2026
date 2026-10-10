export const instant = false;

import { PageHeader } from "@/components/layout/PageHeader";
import { FaqCard } from "@/components/faq/FaqCard";
import { FAQ_ENTRIES } from "@/lib/data/faq";

export default function FaqPage() {
  return (
    <>
      <PageHeader
        title="FAQ"
        subtitle="How AiGIS predicts usage, takes outside news into account and raises purchase orders."
      />
      {FAQ_ENTRIES.map((entry) => (
        <FaqCard key={entry.id} entry={entry} />
      ))}
    </>
  );
}
