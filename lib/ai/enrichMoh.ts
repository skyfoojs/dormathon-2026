import "server-only";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { errorMessage } from "@/lib/ai/errors";
import { fetchMohAttachmentText } from "@/lib/ai/sources/moh";

const MOH_SOURCE_NAME = "MOH Malaysia Press Statements";

const candidateSchema = z.object({ article_id: z.number(), url: z.string() });
type Candidate = z.infer<typeof candidateSchema>;

export type EnrichMohResult = { enriched: number; skipped: number; failed: number };

// MOH's list page carries no summary text, and its article detail pages
// carry no body text either - the real statement only exists inside a PDF
// attachment (see sources/moh.ts). Re-fetching and parsing that PDF for
// every ingested article would be expensive (each fetch takes tens of
// seconds), so this only enriches articles the screener has already judged
// relevant from the title alone - confirmed in practice to triage well on
// its own. Enriched articles go back to screen_status 'pending' so the next
// screenPendingArticles() pass re-scores them with the real content instead
// of the placeholder "only the title is available" summary.
export async function enrichSelectedMohArticles(): Promise<EnrichMohResult> {
  const candidates = await findCandidates();
  if (candidates.length === 0) return { enriched: 0, skipped: 0, failed: 0 };

  const results = await Promise.allSettled(candidates.map(enrichOne));
  return results.reduce<EnrichMohResult>(
    (acc, result) => {
      if (result.status === "rejected") {
        console.error("MOH enrichment failed for an article", errorMessage(result.reason));
        acc.failed += 1;
      } else if (result.value) {
        acc.enriched += 1;
      } else {
        acc.skipped += 1; // no PDF attachment found: not an error, just nothing to add
      }
      return acc;
    },
    { enriched: 0, skipped: 0, failed: 0 },
  );
}

async function findCandidates(): Promise<Candidate[]> {
  const { data, error } = await getDb()
    .from("articles")
    .select("article_id, url, news_sources!inner(name)")
    .eq("screen_status", "selected")
    .is("description", null)
    .eq("news_sources.name", MOH_SOURCE_NAME);
  if (error) throw error;
  return z.array(candidateSchema).parse(data);
}

// Returns true if the article was enriched, false if it had no PDF to pull
// (not an error - throws instead for genuine fetch/parse failures, which
// the caller counts separately).
async function enrichOne(article: Candidate): Promise<boolean> {
  const text = await fetchMohAttachmentText(article.url);
  if (!text) return false;
  const { error } = await getDb()
    .from("articles")
    .update({ description: text, screen_status: "pending" })
    .eq("article_id", article.article_id);
  if (error) throw error;
  return true;
}
