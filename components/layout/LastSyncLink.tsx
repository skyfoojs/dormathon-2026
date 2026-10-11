"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceStrict } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api/resources";
import { SYNC_POLL_MS, isActive } from "@/lib/data/syncRuns";

const IDLE_POLL_MS = 60_000;

// null until mounted: reading the clock during render isn't allowed while
// the shell is prerendered (it broke the production build), so the relative
// time only appears after the first client tick.
function useNow(intervalMs: number): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs]);
  return now;
}

export function LastSyncLink() {
  const runsQuery = useQuery({
    queryKey: ["sync-runs", {}],
    queryFn: () => api.getSyncRuns({}),
    refetchInterval: (query) => (query.state.data?.some(isActive) ? SYNC_POLL_MS : IDLE_POLL_MS),
  });
  const now = useNow(IDLE_POLL_MS);
  const runs = runsQuery.data ?? [];
  const lastSucceeded = runs.find((run) => run.status === "succeeded" && run.finished_at);

  const syncing = runs.some(isActive);
  const failed = !syncing && runs[0]?.status === "failed";

  const label = syncing
    ? "Syncing now…"
    : failed
      ? "Last sync failed"
      : lastSucceeded?.finished_at && now !== null
        ? `Last sync ${formatDistanceStrict(Date.parse(lastSucceeded.finished_at), now, { addSuffix: true, roundingMethod: "floor" })}`
        : runsQuery.isSuccess && !lastSucceeded
          ? "No syncs yet"
          : "Checking last sync…";

  // Rounded indicator pill: border, tint and the dot's glow all follow the
  // state - amber and pulsing while syncing, red if the latest run failed,
  // green once a run has succeeded, grey while there's nothing to report
  // yet. The text carries the same meaning, so colour is never the only
  // signal.
  const tone = syncing
    ? {
        pill: "border-amber-border bg-amber-bg text-amber-text",
        dot: "bg-amber-border ring-amber-border/30 motion-safe:animate-pulse",
      }
    : failed
      ? {
          pill: "border-red bg-red/10 text-red-dark",
          dot: "bg-red ring-red/25",
        }
      : lastSucceeded?.finished_at
        ? {
            pill: "border-green-border bg-green-tint text-green-text",
            dot: "bg-green-text ring-green-text/20",
          }
        : {
            pill: "border-line bg-page text-muted",
            dot: "bg-line-strong ring-line-strong/20",
          };

  return (
    <Link
      href="/predictions"
      className={`flex min-h-11 items-center gap-2.5 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light ${tone.pill}`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${tone.dot}`} aria-hidden="true" />
      {label}
    </Link>
  );
}
