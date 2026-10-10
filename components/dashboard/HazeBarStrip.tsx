import { formatShortDate } from "@/lib/data/dates";
import { hazeCategoryBarClass } from "@/lib/data/haze";
import type { HazeApiCategory } from "@/lib/db/types";

export function HazeBarStrip({
  bars,
}: {
  bars: { weekStart: string; apiAvg: number; category: HazeApiCategory }[];
}) {
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((b) => b.apiAvg), 1);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-xs font-medium tracking-wide text-muted uppercase">
        Haze API, weekly average at this facility
      </div>
      <div className="flex h-20 items-end gap-1 border-b border-line-strong">
        {bars.map((b) => (
          <div
            key={b.weekStart}
            className={`min-w-0 flex-1 ${hazeCategoryBarClass(b.category)}`}
            style={{ height: `${Math.max(4, (b.apiAvg / max) * 100)}%` }}
            title={`${formatShortDate(b.weekStart)}: API ${b.apiAvg}, ${b.category}`}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-xs text-muted">
        <span>
          {formatShortDate(bars[0].weekStart)}: {bars[0].apiAvg}
        </span>
        <span>
          {formatShortDate(bars[bars.length - 1].weekStart)}: {bars[bars.length - 1].apiAvg}
        </span>
      </div>
    </div>
  );
}
