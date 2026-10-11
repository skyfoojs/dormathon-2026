import { z } from "zod";
import { getDb } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { errorResponse, ok } from "@/lib/response";
import { SYNC_RUN_COLUMNS, syncRunSchema, type SyncRun } from "@/lib/ai/sync";
import { CYCLE1_PERSONAS, verdictsSchema } from "@/lib/ai/cycle1";
import { CYCLE2_PERSONAS, forecastsSchema } from "@/lib/ai/cycle2";
import { reviewSchema, type Persona } from "@/lib/ai/council";
import { findRunAiForecasts } from "@/lib/ai/aiForecasts";
import { findForecastsByIds, findLatestForecasts, toForecastBasis, type ForecastRow } from "@/lib/ai/algorithmic";
import { loadForecastInputs } from "@/lib/forecast/run";
import { usageOutlook, type UsageOutlook } from "@/lib/forecast/outlook";

const idParamSchema = z.coerce.number().int().min(1);

const CHAIRMAN_BRIEF = "No persona. Weighs the members' arguments and peer reviews, discounts bias, and decides.";

const itemRowSchema = z.object({ item_id: z.number(), item_name: z.string(), unit: z.string() });
const sourceRowSchema = z.object({
  source_id: z.number(),
  name: z.string(),
  tier: z.number(),
  region: z.string().nullable(),
});
const articleRowSchema = z.object({
  article_id: z.number(),
  source_id: z.number(),
  sync_run_id: z.number(),
  url: z.string(),
  title: z.string(),
  published_at: z.string().nullable(),
  screen_status: z.enum(["pending", "selected", "rejected"]),
  screen_call_id: z.number().nullable(),
  summary: z.string().nullable(),
  reject_reason: z.string().nullable(),
  impact_type: z.string().nullable(),
  regions: z.array(z.string()).nullable(),
  affected_categories: z.array(z.string()).nullable(),
});
const callRowSchema = z.object({
  call_id: z.number(),
  seat_id: z.number().nullable(),
  stage: z.enum(["opinion", "review", "decision"]).nullable(),
  tokens_in: z.number().nullable(),
  tokens_out: z.number().nullable(),
  output: z.unknown(),
  error: z.string().nullable(),
});
const councilRunRowSchema = z.object({ council_run_id: z.number(), cycle: z.union([z.literal(1), z.literal(2)]) });
const seatRowSchema = z.object({
  seat_id: z.number(),
  council_run_id: z.number(),
  role: z.enum(["member", "chairman"]),
  persona: z.string(),
  label: z.string().nullable(),
});
const aiForecastRowSchema = z.object({
  item_id: z.number(),
  triggered: z.boolean(),
  buy_qty: z.number().nullable(),
  threshold_date: z.string().nullable(),
  stockout_date: z.string().nullable(),
  council_run_id: z.number().nullable(),
});
const sourceRunRowSchema = z.object({ sync_run_id: z.number() });
const runForecastRowSchema = z.object({ item_id: z.number(), triggered: z.boolean() });

type ItemRow = z.infer<typeof itemRowSchema>;
type SourceRow = z.infer<typeof sourceRowSchema>;
type ArticleRow = z.infer<typeof articleRowSchema>;
type CallRow = z.infer<typeof callRowSchema>;
type SeatRow = z.infer<typeof seatRowSchema>;
type Verdict = z.infer<typeof verdictsSchema>["verdicts"][number];
type ItemForecast = z.infer<typeof forecastsSchema>["forecasts"][number] & { outlook: UsageOutlook | null };
type Review = z.infer<typeof reviewSchema>;

type Tokens = { tokensIn: number; tokensOut: number; called: boolean };
type MemberDto = Tokens & {
  seatId: number;
  persona: string;
  brief: string;
  label: string;
  error: string | null;
  verdicts: Verdict[] | null;
  forecasts: ItemForecast[] | null;
};
type ReviewDto = Tokens & { label: string; persona: string; review: Review | null; error: string | null };
type ChairmanDto = Tokens & { brief: string; error: string | null; verdicts: Verdict[] | null; forecasts: ItemForecast[] | null };
type OutlookFor = (itemId: number, usageMultiplier: number, fadeDays: number | null) => UsageOutlook | null;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const runId = idParamSchema.parse((await ctx.params).id);
    const run = await findRun(runId);
    const shownRunId = (await findReusedSourceRunId(runId)) ?? runId;
    const [items, sources, calls, fetched, algorithmic, councilRuns, outlookFor] = await Promise.all([
      findItems(),
      findSources(),
      findCalls(shownRunId),
      findArticles("sync_run_id", [shownRunId]),
      run.scope === "full" ? buildAlgorithmic(run) : Promise.resolve(null),
      findCouncilRuns(shownRunId),
      buildOutlookFor([runId, shownRunId]),
    ]);
    const aiForecast = await buildAiForecast(runId, outlookFor);
    const screenerCalls = calls.filter((c) => c.seat_id === null);
    const [screened, referenced, seats] = await Promise.all([
      findArticles("screen_call_id", screenerCalls.map((c) => c.call_id)),
      findArticles("article_id", verdictArticleIds(calls, fetched)),
      findSeats(councilRuns.map((c) => c.council_run_id)),
    ]);
    const sourceName = new Map(sources.map((src) => [src.source_id, src.name]));
    return ok({
      run,
      shownRunId,
      reused: shownRunId !== runId,
      items: items.map((i) => ({ id: i.item_id, name: i.item_name, unit: i.unit })),
      articles: [...fetched, ...referenced].map((a) => toArticleRef(a, sourceName)),
      algorithmic,
      news: toNewsDto(sources, fetched, sourceName),
      screener: screenerCalls.length ? toScreenerDto(screenerCalls, screened, sourceName) : null,
      cycles: councilRuns.map(({ council_run_id, cycle }) =>
        toCycleDto(
          cycle,
          seats.filter((seat) => seat.council_run_id === council_run_id),
          calls,
          outlookFor,
        ),
      ),
      aiForecast,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

async function findRun(runId: number): Promise<SyncRun> {
  const { data, error } = await getDb().from("sync_runs").select(SYNC_RUN_COLUMNS).eq("sync_run_id", runId).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError("Sync run not found");
  return syncRunSchema.parse(data);
}

async function findReusedSourceRunId(runId: number): Promise<number | null> {
  const { data, error } = await getDb()
    .from("ai_forecasts")
    .select("source_ai_forecast_id")
    .eq("sync_run_id", runId)
    .not("source_ai_forecast_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.source_ai_forecast_id) return null;
  const { data: source, error: sourceError } = await getDb()
    .from("ai_forecasts")
    .select("sync_run_id")
    .eq("ai_forecast_id", data.source_ai_forecast_id)
    .single();
  if (sourceError) throw sourceError;
  return sourceRunRowSchema.parse(source).sync_run_id;
}

async function findItems(): Promise<ItemRow[]> {
  const { data, error } = await getDb().from("items").select("item_id, item_name, unit").order("item_name");
  if (error) throw error;
  return z.array(itemRowSchema).parse(data);
}

async function findSources(): Promise<SourceRow[]> {
  const { data, error } = await getDb().from("news_sources").select("source_id, name, tier, region").order("tier");
  if (error) throw error;
  return z.array(sourceRowSchema).parse(data);
}

async function findArticles(
  column: "sync_run_id" | "screen_call_id" | "article_id",
  ids: number[],
): Promise<ArticleRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await getDb()
    .from("articles")
    .select(
      "article_id, source_id, sync_run_id, url, title, published_at, screen_status, screen_call_id, summary, reject_reason, impact_type, regions, affected_categories",
    )
    .in(column, ids)
    .order("published_at", { ascending: false });
  if (error) throw error;
  return z.array(articleRowSchema).parse(data);
}

async function findCalls(runId: number): Promise<CallRow[]> {
  const { data, error } = await getDb()
    .from("llm_calls")
    .select("call_id, seat_id, stage, tokens_in, tokens_out, output, error")
    .eq("sync_run_id", runId)
    .order("call_id");
  if (error) throw error;
  return z.array(callRowSchema).parse(data);
}

function verdictArticleIds(calls: CallRow[], fetched: ArticleRow[]): number[] {
  const ids = calls.flatMap((call) => verdictsSchema.safeParse(call.output).data?.verdicts.map((v) => v.article_id) ?? []);
  return [...new Set(ids)].filter((id) => !fetched.some((a) => a.article_id === id));
}

function toArticleRef(article: ArticleRow, sourceName: Map<number, string>) {
  return { id: article.article_id, title: article.title, source: sourceName.get(article.source_id) ?? "" };
}

function toNewsDto(sources: SourceRow[], fetched: ArticleRow[], sourceName: Map<number, string>) {
  return {
    sources: sources.map((src) => ({
      name: src.name,
      tier: src.tier,
      region: src.region,
      fetched: fetched.filter((a) => a.source_id === src.source_id).length,
    })),
    articles: fetched.map((a) => ({ ...toArticleRef(a, sourceName), url: a.url, publishedAt: a.published_at })),
  };
}

function toScreenerDto(calls: CallRow[], screened: ArticleRow[], sourceName: Map<number, string>) {
  return {
    ...sumTokens(calls),
    articles: screened.map((a) => ({
      ...toArticleRef(a, sourceName),
      selected: a.screen_status === "selected",
      summary: a.summary,
      rejectReason: a.reject_reason,
      impactType: a.impact_type,
      regions: a.regions ?? [],
      categories: a.affected_categories ?? [],
    })),
  };
}

function sumTokens(calls: CallRow[]): Omit<Tokens, "called"> {
  return {
    tokensIn: calls.reduce((sum, c) => sum + (c.tokens_in ?? 0), 0),
    tokensOut: calls.reduce((sum, c) => sum + (c.tokens_out ?? 0), 0),
  };
}

async function findCouncilRuns(runId: number) {
  const { data, error } = await getDb()
    .from("council_runs")
    .select("council_run_id, cycle")
    .eq("sync_run_id", runId)
    .order("cycle");
  if (error) throw error;
  return z.array(councilRunRowSchema).parse(data);
}

async function findSeats(councilRunIds: number[]): Promise<SeatRow[]> {
  if (councilRunIds.length === 0) return [];
  const { data, error } = await getDb()
    .from("council_seats")
    .select("seat_id, council_run_id, role, persona, label")
    .in("council_run_id", councilRunIds)
    .order("seat_id");
  if (error) throw error;
  return z.array(seatRowSchema).parse(data);
}

function toCycleDto(cycle: 1 | 2, seats: SeatRow[], calls: CallRow[], outlookFor: OutlookFor) {
  const personas = cycle === 1 ? CYCLE1_PERSONAS : CYCLE2_PERSONAS;
  const callFor = (seatId: number, stage: CallRow["stage"]) =>
    calls.find((c) => c.seat_id === seatId && c.stage === stage) ?? null;
  const memberSeats = seats.filter((s) => s.role === "member");
  const chairmanSeat = seats.find((s) => s.role === "chairman");

  const members = memberSeats.map((seat) =>
    toMemberDto(cycle, seat, callFor(seat.seat_id, "opinion"), personas, outlookFor),
  );
  const reviews = memberSeats.map((seat) => toReviewDto(seat, callFor(seat.seat_id, "review")));
  const chairman = toChairmanDto(cycle, chairmanSeat ? callFor(chairmanSeat.seat_id, "decision") : null, outlookFor);
  return { cycle, members, reviews, chairman };
}

function toMemberDto(
  cycle: 1 | 2,
  seat: SeatRow,
  call: CallRow | null,
  personas: readonly Persona[],
  outlookFor: OutlookFor,
): MemberDto {
  return {
    seatId: seat.seat_id,
    persona: seat.persona,
    brief: personas.find((p) => p.name === seat.persona)?.brief ?? "",
    label: seat.label ?? "",
    tokensIn: call?.tokens_in ?? 0,
    tokensOut: call?.tokens_out ?? 0,
    called: call !== null,
    error: call ? call.error : "No answer",
    ...parseAnswer(cycle, call, outlookFor),
  };
}

function toReviewDto(seat: SeatRow, call: CallRow | null): ReviewDto {
  return {
    label: seat.label ?? "",
    persona: seat.persona,
    tokensIn: call?.tokens_in ?? 0,
    tokensOut: call?.tokens_out ?? 0,
    called: call !== null,
    error: call ? call.error : "No review",
    review: call ? (reviewSchema.safeParse(call.output).data ?? null) : null,
  };
}

function toChairmanDto(cycle: 1 | 2, call: CallRow | null, outlookFor: OutlookFor): ChairmanDto {
  return {
    brief: CHAIRMAN_BRIEF,
    tokensIn: call?.tokens_in ?? 0,
    tokensOut: call?.tokens_out ?? 0,
    called: call !== null,
    error: call ? call.error : "No decision",
    ...parseAnswer(cycle, call, outlookFor),
  };
}

function parseAnswer(
  cycle: 1 | 2,
  call: CallRow | null,
  outlookFor: OutlookFor,
): Pick<MemberDto, "verdicts" | "forecasts"> {
  if (!call) return { verdicts: null, forecasts: null };
  if (cycle === 1) return { verdicts: verdictsSchema.safeParse(call.output).data?.verdicts ?? null, forecasts: null };
  const forecasts = forecastsSchema.safeParse(call.output).data?.forecasts ?? null;
  return {
    verdicts: null,
    forecasts:
      forecasts?.map((f) => ({ ...f, outlook: outlookFor(f.item_id, f.usage_multiplier, f.fade_days) })) ?? null,
  };
}

async function buildAiForecast(runId: number, outlookFor: OutlookFor) {
  const [adjustments, rows] = await Promise.all([findRunAiForecasts(runId), findRunAiForecastRows(runId)]);
  return rows.map((row) => {
    const adjustment = adjustments.get(row.item_id);
    return {
      itemId: row.item_id,
      usageMultiplier: adjustment?.usageMultiplier ?? null,
      fadeDays: adjustment?.fadeDays ?? null,
      confidence: adjustment?.confidence ?? null,
      triggered: row.triggered,
      buyQty: row.buy_qty,
      thresholdDate: row.threshold_date,
      stockoutDate: row.stockout_date,
      outlook: adjustment ? outlookFor(row.item_id, adjustment.usageMultiplier, adjustment.fadeDays) : null,
    };
  });
}

async function buildOutlookFor(runIds: number[]): Promise<OutlookFor> {
  const [inputs, forecasts] = await Promise.all([loadForecastInputs(), findOutlookForecasts(runIds)]);
  return (itemId, usageMultiplier, fadeDays) => {
    const forecast = forecasts.get(itemId);
    const item = inputs.items.find((i) => i.item_id === itemId);
    if (!forecast || !item) return null;
    return usageOutlook({
      basis: toForecastBasis(forecast, item.cover_days),
      forecastDate: forecast.forecast_date,
      usageMultiplier,
      fadeDays,
      reorderLevel: item.reorder_level,
      dailyRows: inputs.dailyByItem.get(itemId) ?? [],
      purchaseOrders: inputs.purchaseOrdersByItem.get(itemId) ?? [],
    });
  };
}

async function findOutlookForecasts(runIds: number[]): Promise<Map<number, ForecastRow>> {
  const [latest, ...perRun] = await Promise.all([findLatestForecasts(), ...runIds.map((id) => findRunAiForecasts(id))]);
  const forecastIdByItem = new Map<number, number>();
  for (const adjustments of perRun) {
    for (const [itemId, adjustment] of adjustments) {
      if (!forecastIdByItem.has(itemId)) forecastIdByItem.set(itemId, adjustment.forecastId);
    }
  }
  const byId = await findForecastsByIds([...new Set(forecastIdByItem.values())]);
  const result = new Map(latest);
  for (const [itemId, forecastId] of forecastIdByItem) {
    const forecast = byId.get(forecastId);
    if (forecast) result.set(itemId, forecast);
  }
  return result;
}

async function findRunAiForecastRows(runId: number) {
  const { data, error } = await getDb()
    .from("ai_forecasts")
    .select("item_id, triggered, buy_qty, threshold_date, stockout_date, council_run_id")
    .eq("sync_run_id", runId);
  if (error) throw error;
  return z.array(aiForecastRowSchema).parse(data);
}

async function buildAlgorithmic(run: SyncRun) {
  const { data, error } = await getDb()
    .from("demand_forecasts")
    .select("item_id, triggered")
    .gte("created_at", run.started_at)
    .lte("created_at", run.finished_at ?? new Date().toISOString());
  if (error) throw error;
  const rows = z.array(runForecastRowSchema).parse(data);
  return {
    forecastCount: rows.length,
    stockAsOf: run.stock_as_of,
    atOrBelowItemIds: rows.filter((r) => r.triggered).map((r) => r.item_id),
  };
}

