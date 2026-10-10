import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";

export const PAST_NEWS_WINDOW_DAYS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

const verdictRowSchema = z.object({
  council_run_id: z.number(),
  valid: z.boolean(),
  severity: z.number().nullable(),
  impact_type: z.string().nullable(),
  regions: z.array(z.string()).nullable(),
  affected_categories: z.array(z.string()).nullable(),
  reasoning: z.string().nullable(),
});

const recentNewsRowSchema = z.object({
  article_id: z.number(),
  title: z.string(),
  summary: z.string().nullable(),
  published_at: z.string().nullable(),
  impact_type: z.string().nullable(),
  regions: z.array(z.string()).nullable(),
  affected_categories: z.array(z.string()).nullable(),
  news_sources: z.object({ name: z.string(), tier: z.number() }),
  news_verdicts: z.array(verdictRowSchema),
});

type VerdictRow = z.infer<typeof verdictRowSchema>;

export type LatestVerdict = Omit<VerdictRow, "council_run_id">;

export type RecentNews = {
  articleId: number;
  sourceName: string;
  sourceTier: number;
  title: string;
  summary: string | null;
  publishedAt: string | null;
  impactType: string | null;
  regions: string[] | null;
  affectedCategories: string[] | null;
  latestVerdict: LatestVerdict | null;
};

export async function findRecentNews(): Promise<RecentNews[]> {
  const cutoff = new Date(Date.now() - PAST_NEWS_WINDOW_DAYS * DAY_MS).toISOString();
  const { data, error } = await getDb()
    .from("articles")
    .select(
      "article_id, title, summary, published_at, impact_type, regions, affected_categories, news_sources(name, tier), news_verdicts(council_run_id, valid, severity, impact_type, regions, affected_categories, reasoning)",
    )
    .eq("screen_status", "selected")
    .gte("published_at", cutoff)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return z.array(recentNewsRowSchema).parse(data).map(toRecentNews);
}

export function ageInDays(isoDate: string | null): number | null {
  if (!isoDate) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / DAY_MS));
}

function toRecentNews(row: z.infer<typeof recentNewsRowSchema>): RecentNews {
  return {
    articleId: row.article_id,
    sourceName: row.news_sources.name,
    sourceTier: row.news_sources.tier,
    title: row.title,
    summary: row.summary,
    publishedAt: row.published_at,
    impactType: row.impact_type,
    regions: row.regions,
    affectedCategories: row.affected_categories,
    latestVerdict: pickLatestVerdict(row.news_verdicts),
  };
}

function pickLatestVerdict(verdicts: VerdictRow[]): LatestVerdict | null {
  if (verdicts.length === 0) return null;
  const latest = verdicts.reduce((a, b) => (b.council_run_id > a.council_run_id ? b : a));
  return {
    valid: latest.valid,
    severity: latest.severity,
    impact_type: latest.impact_type,
    regions: latest.regions,
    affected_categories: latest.affected_categories,
    reasoning: latest.reasoning,
  };
}
