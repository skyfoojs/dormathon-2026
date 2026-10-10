import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { runCouncil, type Persona } from "@/lib/ai/council";
import { HOSPITAL_LOCATION, findItemCategories } from "@/lib/ai/catalog";
import { PAST_NEWS_WINDOW_DAYS, ageInDays, findRecentNews, type RecentNews } from "@/lib/ai/news";

const CYCLE1_PERSONAS: readonly Persona[] = [
  {
    name: "Skeptic",
    brief: "You doubt the news. Flag hype, single-source claims, unverified numbers and overreaction.",
  },
  {
    name: "Sentinel",
    brief: "You take early warnings seriously: better early than late. Flag signals others may dismiss too quickly.",
  },
  {
    name: "Source credibility analyst",
    brief: "Neutral. Judge source tier, how many sources agree, and any contradictions between reports.",
  },
  {
    name: "Public health & supply risk analyst",
    brief: "Neutral. Judge whether the event is real, spreading and local to the hospital, and whether it hits demand, supply or both.",
  },
];

const CYCLE1_TASK = [
  "Validate each article in new_articles.",
  "valid: is the news credible and real?",
  "severity: impact on this hospital's medical demand or supply, 1 (negligible) to 5 (critical). Consider the hospital location.",
  "impact_type, regions (ISO alpha-2 or GLOBAL) and affected_categories (only from item_categories).",
  "past_news is context only (with its age in days and previous verdict); do not return verdicts for it.",
  "Return exactly one verdict per article_id in new_articles.",
].join("\n");

const verdictsSchema = z.object({
  verdicts: z.array(
    z.object({
      article_id: z.number().int(),
      valid: z.boolean(),
      severity: z.number().int().min(1).max(5),
      impact_type: z.enum(["demand", "supply", "both", "none"]),
      regions: z.array(z.string()),
      affected_categories: z.array(z.string()),
      reasoning: z.string(),
    }),
  ),
});

type Verdict = z.infer<typeof verdictsSchema>["verdicts"][number];

export type Cycle1Result = { councilRunId: number; validated: number; valid: number } | null;

export async function runCycle1(syncRunId: number): Promise<Cycle1Result> {
  const news = await findRecentNews();
  const unvalidated = news.filter((article) => article.latestVerdict === null);
  if (unvalidated.length === 0) return null;

  const validated = news.filter((article) => article.latestVerdict !== null);
  const { councilRunId, decision } = await runCouncil({
    syncRunId,
    cycle: 1,
    task: CYCLE1_TASK,
    data: {
      today: new Date().toISOString().slice(0, 10),
      hospital_location: HOSPITAL_LOCATION,
      item_categories: await findItemCategories(),
      past_news_window_days: PAST_NEWS_WINDOW_DAYS,
      new_articles: unvalidated.map(toNewArticleInput),
      past_news: validated.map(toPastNewsInput),
    },
    personas: CYCLE1_PERSONAS,
    opinionSchema: verdictsSchema,
    decisionSchema: verdictsSchema,
  });

  const verdicts = keepRequestedVerdicts(decision.verdicts, unvalidated);
  await insertVerdicts(councilRunId, verdicts);
  return { councilRunId, validated: verdicts.length, valid: verdicts.filter((verdict) => verdict.valid).length };
}

function toNewArticleInput(article: RecentNews) {
  return {
    article_id: article.articleId,
    source: article.sourceName,
    source_tier: article.sourceTier,
    published_at: article.publishedAt,
    age_days: ageInDays(article.publishedAt),
    title: article.title,
    summary: article.summary,
    screener_tags: {
      impact_type: article.impactType,
      regions: article.regions,
      affected_categories: article.affectedCategories,
    },
  };
}

function toPastNewsInput(article: RecentNews) {
  return {
    article_id: article.articleId,
    source: article.sourceName,
    age_days: ageInDays(article.publishedAt),
    title: article.title,
    summary: article.summary,
    previous_verdict: article.latestVerdict,
  };
}

function keepRequestedVerdicts(verdicts: Verdict[], requested: RecentNews[]): Verdict[] {
  const ids = new Set(requested.map((article) => article.articleId));
  const seen = new Set<number>();
  return verdicts.filter((verdict) => {
    if (!ids.has(verdict.article_id) || seen.has(verdict.article_id)) return false;
    seen.add(verdict.article_id);
    return true;
  });
}

async function insertVerdicts(councilRunId: number, verdicts: Verdict[]): Promise<void> {
  if (verdicts.length === 0) return;
  const { error } = await getDb()
    .from("news_verdicts")
    .insert(verdicts.map((verdict) => ({ council_run_id: councilRunId, ...verdict })));
  if (error) throw error;
}
