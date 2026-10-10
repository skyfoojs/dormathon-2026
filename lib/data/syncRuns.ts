import type { SyncRun } from "@/lib/api/resources";

export const SYNC_POLL_MS = 3000;

export function isActive(run: SyncRun): boolean {
  return run.status === "running" || run.status === "queued";
}
