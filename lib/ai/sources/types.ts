export type FetchedArticle = {
  url: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
};

export type SourceFetcher = (feedUrl: string) => Promise<FetchedArticle[]>;
