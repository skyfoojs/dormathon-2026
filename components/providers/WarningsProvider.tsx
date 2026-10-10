"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getWarnings } from "@/lib/api/resources";
import type { WarningRecord, WarningStatus } from "@/lib/data/warnings";

const SNOOZE_HOURS = 24;

type WarningsContextValue = {
  warnings: WarningRecord[];
  openWarnings: WarningRecord[];
  resolvedOrSnoozed: WarningRecord[];
  openCount: number;
  highOpenCount: number;
  resolve: (id: string) => void;
  snooze: (id: string) => void;
  reopen: (id: string) => void;
  reopenAll: () => void;
};

const WarningsContext = React.createContext<WarningsContextValue | null>(null);

// Warnings are computed server-side from live data on every fetch (there is
// no table to persist resolved/snoozed state against, per the Step 0 schema
// gap), so that state is kept as a local overlay keyed by each warning's
// deterministic id and merged onto the freshly fetched list. It resets on
// reload; see AGENTS brief for the proposed warning_states table.
export function WarningsProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ["warnings"],
    queryFn: getWarnings,
    staleTime: 60_000,
  });
  const serverWarnings = React.useMemo(() => data ?? [], [data]);

  const [overlay, setOverlay] = React.useState<Map<string, { status: WarningStatus; snoozedUntil: string | null }>>(
    new Map(),
  );

  const resolve = React.useCallback((id: string) => {
    setOverlay((prev) => new Map(prev).set(id, { status: "resolved", snoozedUntil: null }));
  }, []);

  const snooze = React.useCallback((id: string) => {
    const until = new Date(Date.now() + SNOOZE_HOURS * 60 * 60 * 1000).toISOString();
    setOverlay((prev) => new Map(prev).set(id, { status: "snoozed", snoozedUntil: until }));
  }, []);

  const reopen = React.useCallback((id: string) => {
    setOverlay((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const reopenAll = React.useCallback(() => {
    setOverlay(new Map());
  }, []);

  const value = React.useMemo<WarningsContextValue>(() => {
    const warnings = serverWarnings.map((w) => {
      const override = overlay.get(w.id);
      return override ? { ...w, status: override.status, snoozedUntil: override.snoozedUntil } : w;
    });
    const openWarnings = warnings.filter((w) => w.status === "open");
    const resolvedOrSnoozed = warnings.filter((w) => w.status !== "open");
    return {
      warnings,
      openWarnings,
      resolvedOrSnoozed,
      openCount: openWarnings.length,
      highOpenCount: openWarnings.filter((w) => w.severity === "high").length,
      resolve,
      snooze,
      reopen,
      reopenAll,
    };
  }, [serverWarnings, overlay, resolve, snooze, reopen, reopenAll]);

  return (
    <WarningsContext.Provider value={value}>
      {children}
    </WarningsContext.Provider>
  );
}

export function useWarnings(): WarningsContextValue {
  const ctx = React.useContext(WarningsContext);
  if (!ctx) {
    throw new Error("useWarnings must be used within a WarningsProvider");
  }
  return ctx;
}
