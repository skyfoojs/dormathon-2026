import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { callLlm } from "@/lib/ai/llm";
import { SCREENER_MODEL } from "@/lib/ai/models";
import { findItemCategories } from "@/lib/ai/catalog";

const SCREEN_BATCH_SIZE = 50;

const impactTypeSchema = z.enum(["demand", "supply", "both", "none"]);

const screenerOutputSchema = z.object({
  results: z.array(
    z.object({
      article_id: z.number().int(),
      relevant: z.boolean(),
      summary: z.string().nullable(),
      reject_reason: z.string().nullable(),
      impact_type: impactTypeSchema,
      regions: z.array(z.string()),
      affected_categories: z.array(z.string()),
    }),
  ),
});

const pendingArticleSchema = z.object({
  article_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  published_at: z.string().nullable(),
  news_sources: z.object({ name: z.string(), tier: z.number(), region: z.string().nullable() }),
});

type PendingArticle = z.infer<typeof pendingArticleSchema>;
type ScreenResult = z.infer<typeof screenerOutputSchema>["results"][number];

const SCREENER_SYSTEM = [
  "You screen news for a hospital inventory system in Malaysia.",
  "For each article decide whether it can affect medical supply or demand, or has world-impacting health consequences.",
  "If relevant: write a factual summary (2-4 sentences). If articles contradict each other, state the contradiction in the summary.",
  "If not relevant: set summary to null and give a short reject_reason.",
  "impact_type: demand (more/less usage), supply (availability, shortages, logistics), both, or none.",
  "regions: ISO 3166-1 alpha-2 country codes affected, or GLOBAL.",
  "affected_categories: only from the provided item categories.",
  "Return exactly one result per article_id given.",
].join("\n");

export type ScreenSummary = { selected: number; rejected: number; unanswered: number };

export async function screenPendingArticles(syncRunId: number): Promise<ScreenSummary> {
  const articles = await findPendingArticles();
  if (articles.length === 0) return { selected: 0, rejected: 0, unanswered: 0 };

  const categories = await findItemCategories();
  const { callId, output } = await callLlm({
    syncRunId,
    model: SCREENER_MODEL,
    system: SCREENER_SYSTEM,
    user: JSON.stringify({ item_categories: categories, articles: articles.map(toScreenerInput) }),
    schemaName: "screener_results",
    schema: screenerOutputSchema,
  });

  const answered = keepKnownArticles(output.results, articles);
  await Promise.all(answered.map((result) => saveScreenResult(result, callId)));
  const selected = answered.filter((result) => result.relevant).length;
  return { selected, rejected: answered.length - selected, unanswered: articles.length - answered.length };
}

async function findPendingArticles(): Promise<PendingArticle[]> {
  const { data, error } = await getDb()
    .from("articles")
    .select("article_id, title, description, published_at, news_sources(name, tier, region)")
    .eq("screen_status", "pending")
    .order("published_at", { ascending: false })
    .limit(SCREEN_BATCH_SIZE);
  if (error) throw error;
  return z.array(pendingArticleSchema).parse(data);
}

function toScreenerInput(article: PendingArticle) {
  return {
    article_id: article.article_id,
    source: article.news_sources.name,
    source_tier: article.news_sources.tier,
    published_at: article.published_at,
    title: article.title,
    description: article.description,
  };
}

function keepKnownArticles(results: ScreenResult[], articles: PendingArticle[]): ScreenResult[] {
  const ids = new Set(articles.map((article) => article.article_id));
  const seen = new Set<number>();
  return results.filter((result) => {
    if (!ids.has(result.article_id) || seen.has(result.article_id)) return false;
    seen.add(result.article_id);
    return true;
  });
}

async function saveScreenResult(result: ScreenResult, callId: number): Promise<void> {
  const { error } = await getDb()
    .from("articles")
    .update({
      screen_status: result.relevant ? "selected" : "rejected",
      screen_call_id: callId,
      summary: result.relevant ? result.summary : null,
      reject_reason: result.relevant ? null : (result.reject_reason ?? "No reason given"),
      impact_type: result.impact_type,
      regions: result.regions,
      affected_categories: result.affected_categories,
    })
    .eq("article_id", result.article_id);
  if (error) throw error;
}
