"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceStrict } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api/resources";
import { SYNC_POLL_MS, isActive } from "@/lib/data/syncRuns";

const IDLE_POLL_MS = 60_000;

function useNow(intervalMs: number): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
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

  const label = runs.some(isActive)
    ? "Syncing now…"
    : lastSucceeded?.finished_at
      ? `Last sync ${formatDistanceStrict(Date.parse(lastSucceeded.finished_at), now, { addSuffix: true, roundingMethod: "floor" })}`
      : runsQuery.isSuccess
        ? "No syncs yet"
        : "Checking last sync…";

  return (
    <Link href="/predictions" className="px-2 text-sm font-semibold text-navy">
      {label}
    </Link>
  );
}
