import { Sigma, Sparkles } from "lucide-react";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { cn, focusRingClasses } from "@/lib/cn";

export type ForecastMode = "ai" | "algorithmic";

const MODES: {
  mode: ForecastMode;
  name: string;
  description: string;
  tag: string;
  tagTone: TagTone;
  Icon: typeof Sparkles;
}[] = [
  {
    mode: "ai",
    name: "AI Powered Forecast",
    description: "Three AI models read your database and the outside signals, challenge each other, then vote.",
    tag: "AI + outside signals",
    tagTone: "blue",
    Icon: Sparkles,
  },
  {
    mode: "algorithmic",
    name: "Algorithmic Forecast",
    description:
      "Plain statistics on your own stock history. No AI and no outside data, so it is fast and easy to audit.",
    tag: "Database only",
    tagTone: "navy",
    Icon: Sigma,
  },
];

export function ForecastModeSwitch({
  mode,
  onChange,
}: {
  mode: ForecastMode;
  onChange: (mode: ForecastMode) => void;
}) {
  return (
    <div role="group" aria-label="Prediction method" className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {MODES.map(({ mode: value, name, description, tag, tagTone, Icon }) => {
        const selected = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(value)}
            className={cn(
              "flex min-h-11 flex-col items-start gap-2 rounded-card border-2 p-4 text-left transition-colors duration-150",
              focusRingClasses,
              selected ? "border-navy bg-blue-tint" : "border-calc-border bg-card hover:bg-page",
            )}
          >
            <span className="flex w-full flex-wrap items-center justify-between gap-2.5">
              <span className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    selected ? "bg-navy text-white" : "bg-blue-tint text-navy",
                  )}
                >
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="text-lg font-bold">{name}</span>
              </span>
              <Tag tone={tagTone}>{tag}</Tag>
            </span>
            <span className="text-sm text-strong-muted">{description}</span>
          </button>
        );
      })}
    </div>
  );
}
