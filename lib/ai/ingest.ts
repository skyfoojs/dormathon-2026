import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorMessage } from "@/lib/ai/errors";
import { fetchWhoDiseaseOutbreakNews } from "@/lib/ai/sources/who";
import { fetchMohPressStatements } from "@/lib/ai/sources/moh";
import type { FetchedArticle, SourceFetcher } from "@/lib/ai/sources/types";

const SOURCE_FETCHERS: Record<string, SourceFetcher> = {
  "WHO Disease Outbreak News": fetchWhoDiseaseOutbreakNews,
  "MOH Malaysia Press Statements": fetchMohPressStatements,
};

const sourceRowSchema = z.object({ source_id: z.number(), name: z.string(), feed_url: z.string() });
const insertedRowSchema = z.object({ article_id: z.number() });

type SourceRow = z.infer<typeof sourceRowSchema>;

export type IngestResult = {
  newArticleIds: number[];
  failedSources: { name: string; error: string }[];
};

export async function ingestNews(syncRunId: number): Promise<IngestResult> {
  const sources = await findActiveSources();
  const results = await Promise.allSettled(sources.map((source) => ingestSource(syncRunId, source)));
  return results.reduce<IngestResult>(
    (acc, result, i) => {
      if (result.status === "fulfilled") {
        acc.newArticleIds.push(...result.value);
      } else {
        acc.failedSources.push({ name: sources[i].name, error: errorMessage(result.reason) });
      }
      return acc;
    },
    { newArticleIds: [], failedSources: [] },
  );
}

async function findActiveSources(): Promise<SourceRow[]> {
  const { data, error } = await getDb().from("news_sources").select("source_id, name, feed_url").eq("active", true);
  if (error) throw error;
  return z.array(sourceRowSchema).parse(data);
}

async function ingestSource(syncRunId: number, source: SourceRow): Promise<number[]> {
  const fetcher = SOURCE_FETCHERS[source.name];
  if (!fetcher) {
    throw new Error(`No fetcher registered for source "${source.name}"`);
  }
  const articles = await fetcher(source.feed_url);
  return insertNewArticles(syncRunId, source.source_id, articles);
}

async function insertNewArticles(syncRunId: number, sourceId: number, articles: FetchedArticle[]): Promise<number[]> {
  if (articles.length === 0) return [];
  const { data, error } = await getDb()
    .from("articles")
    .upsert(
      articles.map((article) => ({
        source_id: sourceId,
        sync_run_id: syncRunId,
        url: article.url,
        title: article.title,
        description: article.description,
        published_at: article.publishedAt,
      })),
      { onConflict: "url", ignoreDuplicates: true },
    )
    .select("article_id");
  if (error) throw error;
  return z.array(insertedRowSchema).parse(data).map((row) => row.article_id);
}
