import "server-only";
import * as cheerio from "cheerio";
// v1, not the current v2: v2 wraps pdfjs-dist's worker-thread model, which
// needs a separate pdf.worker.mjs chunk that Next's bundler doesn't expose
// (confirmed: fails at runtime with "Setting up fake worker failed" even
// though it works fine under plain Node). v1 parses synchronously with no
// worker, which is exactly why it's still the standard choice for
// Node/serverless use despite being the older major version.
// Imported from its inner module, not the package root: v1's index.js has
// a broken `!module.parent` self-test check that misfires under Next's
// bundler and tries to read a nonexistent fixture file on import alone
// (confirmed: threw ENOENT for './test/data/05-versions-space.pdf' just
// from importing the package, before this function was ever called).
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { env } from "@/lib/env";
import { ServiceUnavailableError } from "@/lib/errors";
import type { FetchedArticle } from "@/lib/ai/sources/types";

// moh.gov.my sits behind Akamai, which 403s plain server-side fetches
// (confirmed: even a full browser User-Agent gets rejected) - a real
// browser is required, so this goes through a rendering proxy instead of
// fetching the page directly. Using ZenRows (markets Akamai-bypass
// specifically); ScraperAPI was tried first but its free/standard plan
// doesn't include the premium proxy pool Akamai on this domain requires.
// Swap ZENROWS_API_BASE/params if the project moves providers again.
const ZENROWS_API_BASE = "https://api.zenrows.com/v1/";

// Joomla's standard com_content category-list table markup, confirmed live
// against https://www.moh.gov.my/media-kkm/kenyataan-media/2026:
//   table.com-content-category__table tbody tr.cat-list-row0|row1
//     th.list-title > a[href]           (title + link)
//     td.list-date                      ("30 Julai 2026")
// No summary/description column in this list view.
const ROW_SELECTOR = "table.com-content-category__table tbody tr";
const TITLE_SELECTOR = "th.list-title a";
const DATE_SELECTOR = "td.list-date";

const MALAY_MONTHS: Record<string, string> = {
  januari: "01",
  februari: "02",
  mac: "03",
  april: "04",
  mei: "05",
  jun: "06",
  julai: "07",
  ogos: "08",
  september: "09",
  oktober: "10",
  november: "11",
  disember: "12",
};

// feedUrl is the base category URL with no year
// (https://www.moh.gov.my/media-kkm/kenyataan-media) - the site partitions
// statements by year in the path, so the current year is appended here
// rather than baked into the stored feed_url, which would otherwise go
// stale every January.
export async function fetchMohPressStatements(feedUrl: string): Promise<FetchedArticle[]> {
  const yearUrl = `${feedUrl.replace(/\/+$/, "")}/${new Date().getFullYear()}`;
  // The article table loads via a follow-up AJAX call after first paint;
  // without wait_for, ZenRows returns the page shell before that call
  // resolves (confirmed empirically - table.com-content-category__table is
  // present immediately, but with no <tr> rows inside it yet).
  const html = await fetchRenderedHtml(yearUrl, { waitFor: ROW_SELECTOR });
  const $ = cheerio.load(html);
  const articles: FetchedArticle[] = [];

  $(ROW_SELECTOR).each((_, row) => {
    const link = $(row).find(TITLE_SELECTOR).first();
    const href = link.attr("href");
    const title = link.text().trim();
    if (!href || !title) return; // malformed row: skip rather than fail the whole fetch

    const dateText = $(row).find(DATE_SELECTOR).first().text().trim();
    articles.push({
      url: new URL(href, yearUrl).toString(),
      title,
      description: null,
      publishedAt: parseMalayDate(dateText),
    });
  });

  return articles;
}

const PDF_LINK_SELECTOR = 'a[href$=".pdf"]';

// The detail page's only extra content beyond the title/date already in the
// list view is a "Lampiran" (attachment) section linking to a single PDF
// that holds the real statement text (confirmed: the detail page itself has
// no body text at all). Returns null if there's no PDF to extract rather
// than throwing, since that's a legitimate case (some statements may have
// none), not a fetch failure.
//
// wait_for matters here the same way it did for the list page: without it,
// concurrent detail-page fetches (enrichMoh.ts runs several in parallel)
// can come back before the Lampiran section has rendered, which silently
// looked like "no PDF" rather than a real failure - confirmed empirically,
// not a hypothetical.
export async function fetchMohAttachmentText(articleUrl: string): Promise<string | null> {
  const detailHtml = await fetchRenderedHtml(articleUrl, { waitFor: PDF_LINK_SELECTOR });
  const $ = cheerio.load(detailHtml);
  const pdfHref = $(PDF_LINK_SELECTOR).first().attr("href");
  if (!pdfHref) return null;

  const pdfUrl = new URL(pdfHref, articleUrl).toString();
  const pdfBytes = await fetchFileBytes(pdfUrl);
  const { text } = await pdfParse(pdfBytes);
  const cleaned = text.trim();
  return cleaned.length > 0 ? cleaned : null;
}

async function fetchRenderedHtml(targetUrl: string, opts?: { waitFor?: string }): Promise<string> {
  const params = zenrowsParams(targetUrl);
  params.set("js_render", "true");
  if (opts?.waitFor) params.set("wait_for", opts.waitFor);
  const res = await fetch(`${ZENROWS_API_BASE}?${params}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`MOH Malaysia Press Statements returned ${res.status}`);
  }
  return res.text();
}

// Static files (PDFs, images) are also behind Akamai, but don't need
// js_render - they're not rendered by a browser, just served directly -
// which makes this noticeably faster than fetchRenderedHtml.
async function fetchFileBytes(targetUrl: string): Promise<Buffer> {
  const res = await fetch(`${ZENROWS_API_BASE}?${zenrowsParams(targetUrl)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`MOH Malaysia Press Statements attachment returned ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function zenrowsParams(targetUrl: string): URLSearchParams {
  if (!env.SCRAPER_API_KEY) {
    throw new ServiceUnavailableError("SCRAPER_API_KEY is not configured");
  }
  return new URLSearchParams({ apikey: env.SCRAPER_API_KEY, url: targetUrl, premium_proxy: "true" });
}

// "30 Julai 2026" -> "2026-07-30". Returns null if the text doesn't match
// (kept non-fatal: the article is still ingested, just without a date).
function parseMalayDate(text: string): string | null {
  const match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = MALAY_MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, "0")}`;
}
