"use client";

import * as React from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import {
  STATUS_DOT_CLASS,
  STATUS_DOT_VAR,
  STATUS_LABEL,
} from "@/lib/data/reportStatus";
import type { ReportStatus } from "@/lib/db/types";

const SIZE = 180;
const STROKE = 28;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ReportStatusDonut({
  breakdown,
  onSelectStatus,
  sample = false,
}: {
  breakdown: { status: ReportStatus; count: number }[];
  onSelectStatus: (status: ReportStatus) => void;
  sample?: boolean;
}) {
  const total = breakdown.reduce((sum, b) => sum + b.count, 0);
  const nonZero = breakdown.filter((b) => b.count > 0);
  const summary = nonZero
    .map((b) => `${STATUS_LABEL[b.status]}: ${b.count}`)
    .join(", ");

  const segments = nonZero.reduce<
    { status: ReportStatus; length: number; offset: number; count: number }[]
  >((acc, b) => {
    const length = (b.count / Math.max(1, total)) * CIRCUMFERENCE;
    const prevOffset =
      acc.length > 0
        ? acc[acc.length - 1].offset + acc[acc.length - 1].length
        : 0;
    acc.push({ status: b.status, length, offset: prevOffset, count: b.count });
    return acc;
  }, []);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{
    status: ReportStatus;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  function handleHover(
    e: React.MouseEvent<SVGCircleElement>,
    status: ReportStatus,
    count: number,
  ) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({
      status,
      count,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  return (
    <Card className="flex h-full flex-col gap-4 py-4 px-6">
      <div className="flex items-center gap-2">
        <CardTitle>Purchase order status</CardTitle>
        {sample ? <Tag tone="dashed">Sample data</Tag> : null}
      </div>
      <div
        ref={containerRef}
        role="img"
        aria-label={`${total} reports total. ${summary}.`}
        className="relative mx-auto h-45 w-45"
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-full w-full -rotate-90"
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={STROKE}
          />
          {segments.map((seg) => (
            <circle
              key={seg.status}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={STATUS_DOT_VAR[seg.status]}
              strokeWidth={STROKE}
              strokeDasharray={`${seg.length} ${CIRCUMFERENCE - seg.length}`}
              strokeDashoffset={-seg.offset}
              className="cursor-pointer"
              onMouseEnter={(e) => handleHover(e, seg.status, seg.count)}
              onMouseMove={(e) => handleHover(e, seg.status, seg.count)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectStatus(seg.status)}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-medium">{total}</span>
          <span className="font-mono text-xs tracking-wide text-muted uppercase">
            Reports
          </span>
        </div>
        {hover ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-card px-2 py-1 font-mono text-xs font-semibold whitespace-nowrap text-ink shadow-md"
            style={{ left: hover.x, top: hover.y - 10 }}
          >
            {STATUS_LABEL[hover.status]}: {hover.count}
          </div>
        ) : null}
      </div>

      <ul className="flex flex-col divide-y divide-line gap-y-1">
        {breakdown.map((b) => (
          <li key={b.status}>
            <button
              type="button"
              onClick={() => onSelectStatus(b.status)}
              className="flex min-h-6 w-full items-center justify-between gap-3 rounded-md px-2 text-left text-sm transition-colors duration-150 hover:bg-page focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
            >
              <span className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[b.status]}`}
                  aria-hidden="true"
                />
                {STATUS_LABEL[b.status]}
              </span>
              <span className="font-mono font-semibold">{b.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
