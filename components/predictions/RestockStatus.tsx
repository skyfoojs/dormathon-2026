import { Tag, type TagTone } from "@/components/ui/Tag";
import { formatShortDate } from "@/lib/data/dates";
import type { RestockTrigger } from "@/lib/forecast/runout";

type Status = { tone: TagTone; label: string; detail: string };

function getStatus(name: string, trigger: RestockTrigger | null, unit: string): Status {
  if (!trigger) {
    return {
      tone: "green",
      label: `${name}: no restock needed yet`,
      detail: "Projected stock stays above the restock trigger for the next 12 weeks.",
    };
  }
  if (trigger.alreadyReached) {
    return { tone: "red", label: `${name}: restock now`, detail: "Stock is already at or below the restock trigger." };
  }
  const days = trigger.daysFromLastActual;
  return {
    tone: "amber",
    label: `${name}: restock by ${formatShortDate(trigger.date)}`,
    detail: `${days} day${days === 1 ? "" : "s"} after the last count, once about ${Math.round(trigger.demandUntilTrigger).toLocaleString()} ${unit} more are used.`,
  };
}

export function RestockStatus({
  lines,
  unit,
}: {
  lines: { name: string; trigger: RestockTrigger | null }[];
  unit: string;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {lines.map(({ name, trigger }) => {
        const status = getStatus(name, trigger, unit);
        return (
          <li key={name} className="flex flex-wrap items-center gap-3">
            <Tag tone={status.tone}>{status.label}</Tag>
            <span className="text-sm text-strong-muted">{status.detail}</span>
          </li>
        );
      })}
    </ul>
  );
}
