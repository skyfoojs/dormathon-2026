import { z } from "zod";
import { env } from "@/lib/env";
import { classifyHazeApi } from "@/lib/db/seed";
import { errorResponse, ok } from "@/lib/response";
import { ServiceUnavailableError } from "@/lib/errors";

// World Air Quality Index (aqicn.org) "feed" endpoint: real-time current
// conditions for the nearest station to a fixed coordinate (Petaling Jaya,
// Selangor). Confirmed by testing: it has no historical or forecast data on
// this token's tier ("forecast": {} comes back empty), so this can only
// ever represent "right now, near one reference point" - never a specific
// facility's own reading. See getHazeLive's caller for how that's labelled.
const WAQI_COORDINATES = "geo:3.0642277081841227;101.61747439694862";
const WAQI_LOCATION_LABEL = "Petaling Jaya, Selangor";

const waqiResponseSchema = z.object({
  status: z.string(),
  data: z
    .object({
      aqi: z.number(),
      city: z.object({ name: z.string() }).optional(),
      time: z.object({ iso: z.string() }).optional(),
    })
    .optional(),
});

let cache: { body: unknown; expiresAt: number } | null = null;
const CACHE_MS = 15 * 60 * 1000;

export async function GET() {
  try {
    if (cache && cache.expiresAt > Date.now()) {
      return ok(cache.body);
    }
    const result = await fetchLiveHaze();
    cache = { body: result, expiresAt: Date.now() + CACHE_MS };
    return ok(result);
  } catch (err) {
    return errorResponse(err);
  }
}

async function fetchLiveHaze() {
  if (!env.WAQI_API_TOKEN) {
    throw new ServiceUnavailableError("WAQI_API_TOKEN is not configured");
  }
  const res = await fetch(`https://api.waqi.info/feed/${WAQI_COORDINATES}/?token=${env.WAQI_API_TOKEN}`, {
    cache: "no-store",
  });
  const json = waqiResponseSchema.parse(await res.json());
  if (json.status !== "ok" || !json.data) {
    throw new ServiceUnavailableError("WAQI feed did not return a reading");
  }
  return {
    apiAvg: json.data.aqi,
    category: classifyHazeApi(json.data.aqi),
    observedAt: json.data.time?.iso ?? null,
    locationLabel: WAQI_LOCATION_LABEL,
  };
}
