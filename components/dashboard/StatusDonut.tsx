"use client";

import * as React from "react";
import { Card, CardTitle } from "@/components/ui/Card";

const SIZE = 180;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type StatusDonutSegment = {
  key: string;
  label: string;
  count: number;
  // A CSS variable reference to a theme colour, for the SVG stroke, and the
  // matching Tailwind class for the legend dot.
  colorVar: string;
  dotClass: string;
};

// A donut of counts by status with a legend underneath. `unitLabel` names
// what is being counted, shown under the total in the middle.
export function StatusDonut({
  title,
  unitLabel,
  segments,
}: {
  title: string;
  unitLabel: string;
  segments: StatusDonutSegment[];
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  const nonZero = segments.filter((s) => s.count > 0);
  const summary = nonZero.map((s) => `${s.label}: ${s.count}`).join(", ");

  const arcs = nonZero.reduce<{ segment: StatusDonutSegment; length: number; offset: number }[]>((acc, segment) => {
    const length = (segment.count / Math.max(1, total)) * CIRCUMFERENCE;
    const prev = acc[acc.length - 1];
    acc.push({ segment, length, offset: prev ? prev.offset + prev.length : 0 });
    return acc;
  }, []);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{ segment: StatusDonutSegment; x: number; y: number } | null>(null);

  function handleHover(e: React.MouseEvent<SVGCircleElement>, segment: StatusDonutSegment) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ segment, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <Card className="flex h-full flex-col gap-4 px-6 py-4">
      <CardTitle>{title}</CardTitle>
      <div
        ref={containerRef}
        role="img"
        aria-label={`${total} ${unitLabel.toLowerCase()} in total. ${summary}.`}
        className="relative mx-auto h-45 w-45"
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={STROKE}
          />
          {arcs.map(({ segment, length, offset }) => (
            <circle
              key={segment.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={segment.colorVar}
              strokeWidth={STROKE}
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-offset}
              onMouseEnter={(e) => handleHover(e, segment)}
              onMouseMove={(e) => handleHover(e, segment)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-medium">{total}</span>
          <span className="font-mono text-xs tracking-wide text-muted uppercase">{unitLabel}</span>
        </div>
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-card px-2 py-1 font-mono text-xs font-semibold whitespace-nowrap text-ink shadow-md"
            style={{ left: hover.x, top: hover.y - 10 }}
          >
            {hover.segment.label}: {hover.segment.count}
          </div>
        ) : null}
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between gap-3 px-2 py-1.5 text-sm">
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.dotClass}`} aria-hidden="true" />
              {segment.label}
            </span>
            <span className="font-mono font-semibold">{segment.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
