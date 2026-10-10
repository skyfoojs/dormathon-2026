import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { ServiceUnavailableError, UnauthorizedError } from "@/lib/errors";
import { created, errorResponse } from "@/lib/response";
import { executeSyncRun, startSyncRun, type SyncScope } from "@/lib/ai/sync";

export const maxDuration = 300;

const scheduledSyncSchema = z.object({
  trigger: z.enum(["hourly", "daily"]),
});

const SCOPE_BY_TRIGGER: Record<z.infer<typeof scheduledSyncSchema>["trigger"], SyncScope> = {
  hourly: "news",
  daily: "full",
};

export async function POST(req: Request) {
  try {
    assertCronSecret(req.headers.get("authorization"));
    const { trigger } = scheduledSyncSchema.parse(await req.json());
    const run = await startSyncRun(trigger, SCOPE_BY_TRIGGER[trigger]);
    after(() => executeSyncRun(run));
    return created(run);
  } catch (err) {
    return errorResponse(err);
  }
}

function assertCronSecret(authorization: string | null): void {
  if (!env.CRON_SECRET) throw new ServiceUnavailableError("CRON_SECRET is not configured");
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const given = Buffer.from(authorization ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new UnauthorizedError("Invalid cron secret");
  }
}
