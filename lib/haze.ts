import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { ServiceUnavailableError } from "@/lib/errors";
import { classifyHazeApi } from "@/lib/db/seed";
import { addDays, dayNumber } from "@/lib/forecast/demand";
import type { HazeApiCategory } from "@/lib/db/types";

export const HAZE_TRACKER_NAME = "Haze (Air Pollutant Index)";
const HAZE_METRIC = "aqi";
const WAQI_COORDINATES = "geo:3.0642277081841227;101.61747439694862";
const WAQI_LOCATION_LABEL = "Petaling Jaya, Selangor";
const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;
const SUMMARY_DAYS = 14;
const SUMMARY_WEEKS = 8;

const waqiResponseSchema = z.object({
  status: z.string(),
  data: z
    .object({
      aqi: z.number(),
      time: z.object({ iso: z.string() }).optional(),
    })
    .optional(),
});
const trackerRowSchema = z.object({ tracker_id: z.number() });
const readingRowSchema = z.object({ recorded_at: z.string(), value: z.number().nullable() });

export type LiveHazeReading = {
  apiAvg: number;
  category: HazeApiCategory;
  observedAt: string | null;
  locationLabel: string;
};

export type HazePoint = { date: string; aqi: number; category: HazeApiCategory };

export type HazeSummary = {
  latest: HazePoint;
  daily: HazePoint[];
  weekly: (HazePoint & { weekEnding: string })[];
  changeVsYesterday: number | null;
  changeVsLastWeekPct: number | null;
};

export async function fetchLiveHaze(): Promise<LiveHazeReading> {
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

export async function recordHazeReading(): Promise<void> {
  const [reading, trackerId] = await Promise.all([fetchLiveHaze(), findHazeTrackerId()]);
  const day = (reading.observedAt ?? toMytIso(new Date())).slice(0, 10);
  const recordedAt = `${day}T12:00:00+08:00`;
  const existing = await findDayRecord(trackerId, recordedAt);
  if (existing === null) {
    await insertDayRecord(trackerId, recordedAt, reading.apiAvg);
  } else if (reading.apiAvg > existing) {
    await updateDayRecord(trackerId, recordedAt, reading.apiAvg);
  }
}

async function findDayRecord(trackerId: number, recordedAt: string): Promise<number | null> {
  const { data, error } = await getDb()
    .from("tracker_readings")
    .select("recorded_at, value")
    .eq("tracker_id", trackerId)
    .eq("metric", HAZE_METRIC)
    .eq("recorded_at", recordedAt)
    .maybeSingle();
  if (error) throw error;
  return data ? (readingRowSchema.parse(data).value ?? 0) : null;
}

async function insertDayRecord(trackerId: number, recordedAt: string, value: number): Promise<void> {
  const { error } = await getDb()
    .from("tracker_readings")
    .insert({ tracker_id: trackerId, metric: HAZE_METRIC, recorded_at: recordedAt, value });
  if (error) throw error;
}

async function updateDayRecord(trackerId: number, recordedAt: string, value: number): Promise<void> {
  const { error } = await getDb()
    .from("tracker_readings")
    .update({ value })
    .eq("tracker_id", trackerId)
    .eq("metric", HAZE_METRIC)
    .eq("recorded_at", recordedAt);
  if (error) throw error;
}

export async function findHazeSummary(): Promise<HazeSummary | null> {
  return summariseHaze(await findRecentReadings());
}

export async function hazeCategoryChangedSince(sinceIso: string): Promise<boolean> {
  const readings = (await findRecentReadings()).filter((r) => r.value !== null);
  const before = readings.filter((r) => Date.parse(r.recorded_at) <= Date.parse(sinceIso)).at(-1);
  const latest = readings.at(-1);
  if (!before?.value || !latest?.value) return false;
  return classifyHazeApi(before.value) !== classifyHazeApi(latest.value);
}

async function findRecentReadings(): Promise<z.infer<typeof readingRowSchema>[]> {
  const trackerId = await findHazeTrackerId();
  const since = toMytIso(new Date(Date.now() - (SUMMARY_WEEKS * 7 + 7) * 24 * 60 * 60 * 1000)).slice(0, 10);
  const { data, error } = await getDb()
    .from("tracker_readings")
    .select("recorded_at, value")
    .eq("tracker_id", trackerId)
    .eq("metric", HAZE_METRIC)
    .gte("recorded_at", since)
    .order("recorded_at");
  if (error) throw error;
  return z
    .array(readingRowSchema)
    .parse(data)
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
}

async function findHazeTrackerId(): Promise<number> {
  const { data, error } = await getDb().from("trackers").select("tracker_id").eq("name", HAZE_TRACKER_NAME).single();
  if (error) throw error;
  return trackerRowSchema.parse(data).tracker_id;
}

function summariseHaze(readings: z.infer<typeof readingRowSchema>[]): HazeSummary | null {
  const byDay = new Map<string, number[]>();
  for (const reading of readings) {
    if (reading.value === null) continue;
    const day = reading.recorded_at.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), reading.value]);
  }
  const days = [...byDay.keys()].sort();
  if (days.length === 0) return null;
  const dailyAll = days.map((date) => toPoint(date, average(byDay.get(date) ?? [])));
  const latest = dailyAll[dailyAll.length - 1];
  const weekly = Array.from({ length: SUMMARY_WEEKS }, (_, i) => {
    const weekEnding = addDays(latest.date, -7 * i);
    const values = dailyAll.filter((p) => dayNumber(p.date) <= dayNumber(weekEnding) && dayNumber(p.date) > dayNumber(weekEnding) - 7);
    return values.length ? { ...toPoint(weekEnding, average(values.map((p) => p.aqi))), weekEnding } : null;
  })
    .filter((w): w is HazePoint & { weekEnding: string } => w !== null)
    .reverse();
  const yesterday = dailyAll.find((p) => p.date === addDays(latest.date, -1));
  const [lastWeek, thisWeek] = weekly.slice(-2);
  return {
    latest,
    daily: dailyAll.slice(-SUMMARY_DAYS),
    weekly,
    changeVsYesterday: yesterday ? latest.aqi - yesterday.aqi : null,
    changeVsLastWeekPct:
      weekly.length >= 2 && lastWeek.aqi > 0 ? Math.round(((thisWeek.aqi - lastWeek.aqi) / lastWeek.aqi) * 100) : null,
  };
}

function toPoint(date: string, aqi: number): HazePoint {
  const rounded = Math.round(aqi);
  return { date, aqi: rounded, category: classifyHazeApi(rounded) };
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
}

function toMytIso(date: Date): string {
  return `${new Date(date.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 19)}+08:00`;
}
