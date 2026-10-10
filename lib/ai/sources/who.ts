import "server-only";
import { z } from "zod";
import type { FetchedArticle } from "@/lib/ai/sources/types";

const WHO_ITEM_BASE_URL = "https://www.who.int/emergencies/disease-outbreak-news/item";
const WHO_FIELDS = "Id,UrlName,Title,OverrideTitle,UseOverrideTitle,PublicationDateAndTime,Summary";
const WHO_PAGE_SIZE = 20;

const whoResponseSchema = z.object({
  value: z.array(
    z.object({
      UrlName: z.string().min(1),
      Title: z.string().nullable(),
      OverrideTitle: z.string().nullable(),
      UseOverrideTitle: z.boolean().nullable(),
      PublicationDateAndTime: z.string().nullable(),
      Summary: z.string().nullable(),
    }),
  ),
});

type WhoItem = z.infer<typeof whoResponseSchema>["value"][number];

export async function fetchWhoDiseaseOutbreakNews(feedUrl: string): Promise<FetchedArticle[]> {
  const res = await fetch(buildWhoUrl(feedUrl), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`WHO Disease Outbreak News returned ${res.status}`);
  }
  const json = whoResponseSchema.parse(await res.json());
  return json.value.map(toFetchedArticle);
}

function buildWhoUrl(feedUrl: string): string {
  const url = new URL(feedUrl);
  url.searchParams.set("$orderby", "PublicationDateAndTime desc");
  url.searchParams.set("$top", String(WHO_PAGE_SIZE));
  url.searchParams.set("$select", WHO_FIELDS);
  return url.toString();
}

function toFetchedArticle(item: WhoItem): FetchedArticle {
  const title = item.UseOverrideTitle && item.OverrideTitle ? item.OverrideTitle : (item.Title ?? item.UrlName);
  return {
    url: `${WHO_ITEM_BASE_URL}/${item.UrlName}`,
    title: stripHtml(title),
    description: item.Summary ? stripHtml(item.Summary) : null,
    publishedAt: item.PublicationDateAndTime,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
