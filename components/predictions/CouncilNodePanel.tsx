"use client";

import * as React from "react";
import { MousePointerClick, X } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Label, Select } from "@/components/ui/Input";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { ItemSelect } from "@/components/predictions/ItemSelect";
import {
  backToNormal,
  impactLabel,
  outlookCells,
  outlookText,
  personaInitials,
  usageChange,
} from "@/components/predictions/councilFormat";
import { createTableColumnHelper } from "@/lib/table/features";
import { cn, focusRingClasses } from "@/lib/cn";
import { formatShortDate } from "@/lib/data/dates";
import type {
  CouncilCycle,
  CouncilItemForecast,
  CouncilMember,
  CouncilVerdict,
  RunCouncil,
} from "@/lib/api/resources";

type CouncilItem = RunCouncil["items"][number];
type Lookups = { itemName: (id: number) => string; unitOf: (id: number) => string; articleTitle: (id: number) => string };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-3">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  );
}

function Tokens({ tokensIn, tokensOut }: { tokensIn: number; tokensOut: number }) {
  return (
    <p className="font-mono text-xs text-muted">
      {tokensIn.toLocaleString()} tokens in {"·"} {tokensOut.toLocaleString()} tokens out
    </p>
  );
}

function TagList({ values }: { values: string[] }) {
  if (values.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <Tag key={v} tone="grey">
          {v}
        </Tag>
      ))}
    </span>
  );
}

function ImpactTag({ impact }: { impact: string | null }) {
  const label = impactLabel(impact);
  return label ? <Tag tone="blue">Impact: {label}</Tag> : null;
}

function MemberName({ name, final }: { name: string; final: boolean }) {
  return <span className={cn(final && "font-semibold")}>{name}</span>;
}

function Value({ overruled, children }: { overruled: boolean; children: React.ReactNode }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-mono">{children}</span>
      {overruled ? <span className="text-xs font-semibold text-red-dark">(overruled)</span> : null}
    </span>
  );
}

function Reasoning({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-line pt-2">
      <Eyebrow>{label}</Eyebrow>
      <p className="text-sm text-strong-muted">{text}</p>
    </div>
  );
}

function VerdictView({ verdict, reasoningLabel }: { verdict: CouncilVerdict; reasoningLabel: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <Tag tone={verdict.valid ? "green" : "red"}>{verdict.valid ? "Valid" : "Not valid"}</Tag>
        <Tag tone="amber">Severity {verdict.severity}/5</Tag>
        <ImpactTag impact={verdict.impact_type} />
      </span>
      <TagList values={verdict.affected_categories} />
      <Reasoning label={reasoningLabel} text={verdict.reasoning} />
    </div>
  );
}

function ForecastView({
  forecast,
  unit,
  reasoningLabel,
}: {
  forecast: CouncilItemForecast;
  unit: string;
  reasoningLabel: string;
}) {
  const change = usageChange(forecast.usage_multiplier);
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <Tag tone="navy">{outlookText(forecast.outlook, unit)}</Tag>
        <Tag tone={change.tone}>{change.text}</Tag>
        <Tag tone="grey">{backToNormal(forecast.fade_days)}</Tag>
        <Tag tone="grey">Confidence {Math.round(forecast.confidence * 100)}%</Tag>
      </span>
      <Reasoning label={reasoningLabel} text={forecast.reasoning} />
    </div>
  );
}

function ArticleSelect({
  ids,
  value,
  onChange,
  lookups,
}: {
  ids: number[];
  value: number | null;
  onChange: (id: number) => void;
  lookups: Lookups;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="panel-article">Article</Label>
      <Select id="panel-article" value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))}>
        {ids.map((id) => (
          <option key={id} value={id}>
            {lookups.articleTitle(id)}
          </option>
        ))}
      </Select>
    </div>
  );
}

type Picker = {
  articleId: number | null;
  setArticleId: (id: number) => void;
  itemId: number | null;
  setItemId: (id: number) => void;
};

type PanelContext = { picker: Picker; lookups: Lookups; items: CouncilItem[] };

function pickArticle(verdicts: CouncilVerdict[], picked: number | null): number {
  const match = verdicts.find((v) => v.article_id === picked);
  return (match ?? verdicts[0]).article_id;
}

function CycleAnswer({
  cycle,
  verdicts,
  forecasts,
  reasoningLabel,
  picker,
  lookups,
  items,
}: {
  cycle: 1 | 2;
  verdicts: CouncilVerdict[] | null;
  forecasts: CouncilItemForecast[] | null;
  reasoningLabel: string;
} & PanelContext) {
  if (cycle === 1) {
    if (!verdicts?.length) return <p className="text-sm text-muted">No verdicts.</p>;
    const articleId = pickArticle(verdicts, picker.articleId);
    const verdict = verdicts.find((v) => v.article_id === articleId);
    return (
      <>
        <ArticleSelect ids={verdicts.map((v) => v.article_id)} value={articleId} onChange={picker.setArticleId} lookups={lookups} />
        {verdict ? <VerdictView verdict={verdict} reasoningLabel={reasoningLabel} /> : null}
      </>
    );
  }
  if (!forecasts?.length) return <p className="text-sm text-muted">No forecasts.</p>;
  const forecast = forecasts.find((f) => f.item_id === picker.itemId);
  return (
    <>
      <ItemSelect id="panel-item" items={items} value={picker.itemId} onChange={picker.setItemId} />
      {forecast ? (
        <ForecastView forecast={forecast} unit={lookups.unitOf(forecast.item_id)} reasoningLabel={reasoningLabel} />
      ) : (
        <p className="text-sm text-muted">No answer for this item.</p>
      )}
    </>
  );
}

function MemberPanel({ cycle, seatId, ...context }: { cycle: CouncilCycle; seatId: number } & PanelContext) {
  const member = cycle.members.find((m) => m.seatId === seatId);
  if (!member) return null;
  return (
    <>
      <Section title={`Cycle ${cycle.cycle} persona`}>
        <p className="text-base font-semibold">{member.persona}</p>
        <p className="text-sm text-strong-muted">{member.brief}</p>
        <Tokens tokensIn={member.tokensIn} tokensOut={member.tokensOut} />
        {member.error && member.called ? <Tag tone="red">Dropped: {member.error}</Tag> : null}
      </Section>
      <Section title={cycle.cycle === 1 ? "Verdict and thoughts" : "Forecast and thoughts"}>
        <CycleAnswer
          cycle={cycle.cycle}
          verdicts={member.verdicts}
          forecasts={member.forecasts}
          reasoningLabel={`${member.persona}'s thoughts`}
          {...context}
        />
      </Section>
    </>
  );
}

type Convincing = "most" | "middle" | "least";

const CONVINCING: Record<Convincing, { label: string; tone: TagTone }> = {
  most: { label: "Most", tone: "green" },
  middle: { label: "Middle", tone: "amber" },
  least: { label: "Least", tone: "red" },
};

function rankGiven(cycle: CouncilCycle, reviewer: CouncilMember, reviewed: CouncilMember): Convincing | null {
  const ranking = cycle.reviews.find((r) => r.persona === reviewer.persona)?.review?.ranking ?? [];
  const index = ranking.findIndex((entry) => entry.trim().split(/\s+/).at(-1) === reviewed.label);
  if (index === -1) return null;
  if (index === 0) return "most";
  return index === ranking.length - 1 ? "least" : "middle";
}

function firstRankedPair(cycle: CouncilCycle): { reviewer: CouncilMember; reviewed: CouncilMember } | null {
  for (const reviewer of cycle.members) {
    for (const reviewed of cycle.members) {
      if (reviewer !== reviewed && rankGiven(cycle, reviewer, reviewed) !== null) return { reviewer, reviewed };
    }
  }
  return null;
}

type MatrixRow = { reviewer: CouncilMember | null };
const matrixHelper = createTableColumnHelper<MatrixRow>();

function ReviewPanel({ cycle }: { cycle: CouncilCycle }) {
  const [picked, setPair] = React.useState<{ reviewer: CouncilMember; reviewed: CouncilMember } | null>(null);
  const members = cycle.members;
  const pair = picked ?? firstRankedPair(cycle);
  const mostConvincing = (reviewed: CouncilMember): string => {
    const ranks = members.flatMap((reviewer) => {
      const rank = reviewer === reviewed ? null : rankGiven(cycle, reviewer, reviewed);
      return rank === null ? [] : [rank];
    });
    return ranks.length ? `${ranks.filter((r) => r === "most").length} of ${ranks.length}` : "—";
  };
  const columns = [
    matrixHelper.display({
      id: "reviewer",
      header: "Reviewer",
      cell: ({ row }) =>
        row.original.reviewer ? (
          <span className="font-semibold">{row.original.reviewer.persona}</span>
        ) : (
          <span className="font-mono text-xs text-muted uppercase">Most convincing to</span>
        ),
    }),
    ...members.map((reviewed) =>
      matrixHelper.display({
        id: `reviewed-${reviewed.seatId}`,
        header: () => <abbr title={reviewed.persona}>{personaInitials(reviewed.persona)}</abbr>,
        cell: ({ row }) => {
          const reviewer = row.original.reviewer;
          if (!reviewer) return <span className="font-mono whitespace-nowrap">{mostConvincing(reviewed)}</span>;
          if (reviewer === reviewed) return <span className="text-muted">—</span>;
          const rank = rankGiven(cycle, reviewer, reviewed);
          if (rank === null) return <span className="text-muted">·</span>;
          const selected = pair?.reviewer === reviewer && pair.reviewed === reviewed;
          return (
            <button
              type="button"
              aria-pressed={selected}
              aria-label={`${reviewer.persona} found ${reviewed.persona} ${CONVINCING[rank].label.toLowerCase()} convincing`}
              onClick={() => setPair({ reviewer, reviewed })}
              className={cn(
                "flex cursor-pointer rounded-md p-0.5 transition duration-150 hover:ring-2 hover:ring-blue-light",
                focusRingClasses,
                selected && "ring-2 ring-navy",
              )}
            >
              <Tag tone={CONVINCING[rank].tone}>{CONVINCING[rank].label}</Tag>
            </button>
          );
        },
      }),
    ),
  ];
  const critique = pair
    ? cycle.reviews
        .find((r) => r.persona === pair.reviewer.persona)
        ?.review?.critiques.find((c) => c.label.trim().split(/\s+/).at(-1) === pair.reviewed.label)
    : undefined;

  return (
    <>
      <Section title={`Cycle ${cycle.cycle} peer review`}>
        <p className="text-sm text-strong-muted">
          How convincing each reviewer found the other members&apos; answers: Most, Middle or Least convincing.
        </p>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <MousePointerClick size={16} aria-hidden="true" />
          Click any cell to read why
        </p>
        <DataTable compact
          columns={columns}
          data={[...members.map((reviewer) => ({ reviewer })), { reviewer: null }]}
          getRowId={(r) => (r.reviewer ? String(r.reviewer.seatId) : "average")}
        />
      </Section>
      {pair ? (
        <Section
          title={`Why ${pair.reviewer.persona} found ${pair.reviewed.persona} ${CONVINCING[rankGiven(cycle, pair.reviewer, pair.reviewed) ?? "middle"].label.toLowerCase()} convincing`}
        >
          {critique ? (
            <>
              <p className="text-sm text-strong-muted">
                <span className="font-medium text-green-text">Strengths: </span>
                {critique.strengths}
              </p>
              <p className="text-sm text-strong-muted">
                <span className="font-medium text-red-dark">Concerns: </span>
                {critique.concerns}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No written review.</p>
          )}
        </Section>
      ) : null}
    </>
  );
}

type VerdictRow = { who: string; verdict: CouncilVerdict | undefined; final: boolean };
const verdictHelper = createTableColumnHelper<VerdictRow>();

function VerdictCompare({ cycle, articleId }: { cycle: CouncilCycle; articleId: number }) {
  const final = cycle.chairman.verdicts?.find((v) => v.article_id === articleId);
  const rows: VerdictRow[] = [
    { who: "Chairman (final)", verdict: final, final: true },
    ...cycle.members.map((m) => ({ who: m.persona, verdict: m.verdicts?.find((v) => v.article_id === articleId), final: false })),
  ];
  const overruled = (row: VerdictRow, pick: (v: CouncilVerdict) => unknown) =>
    !row.final && row.verdict !== undefined && final !== undefined && pick(row.verdict) !== pick(final);
  const columns = [
    verdictHelper.accessor((r) => r.who, {
      id: "who",
      header: "Member",
      cell: ({ row }) => (
        <MemberName name={row.original.who} final={row.original.final} />
      ),
    }),
    verdictHelper.display({
      id: "valid",
      header: "Valid",
      cell: ({ row }) =>
        row.original.verdict ? (
          <Value overruled={overruled(row.original, (v) => v.valid)}>{row.original.verdict.valid ? "Yes" : "No"}</Value>
        ) : (
          "—"
        ),
    }),
    verdictHelper.display({
      id: "severity",
      header: "Severity",
      cell: ({ row }) =>
        row.original.verdict ? (
          <Value overruled={overruled(row.original, (v) => v.severity)}>{row.original.verdict.severity}/5</Value>
        ) : (
          "—"
        ),
    }),
    verdictHelper.display({
      id: "impact",
      header: "Impact",
      cell: ({ row }) =>
        row.original.verdict ? (
          <Value overruled={overruled(row.original, (v) => v.impact_type)}>
            {impactLabel(row.original.verdict.impact_type) ?? "None"}
          </Value>
        ) : (
          "—"
        ),
    }),
  ];
  return <DataTable compact columns={columns} data={rows} getRowId={(r) => r.who} />;
}

type ForecastRow = { who: string; forecast: CouncilItemForecast | undefined; final: boolean };
const forecastHelper = createTableColumnHelper<ForecastRow>();

function ForecastCompare({ cycle, itemId, unit }: { cycle: CouncilCycle; itemId: number; unit: string }) {
  const final = cycle.chairman.forecasts?.find((f) => f.item_id === itemId);
  const rows: ForecastRow[] = [
    { who: "Chairman (final)", forecast: final, final: true },
    ...cycle.members.map((m) => ({ who: m.persona, forecast: m.forecasts?.find((f) => f.item_id === itemId), final: false })),
  ];
  const cells = (f: CouncilItemForecast | undefined) => outlookCells(f?.outlook ?? null, unit);
  const overruled = (row: ForecastRow, pick: (f: CouncilItemForecast) => string) =>
    !row.final && row.forecast !== undefined && final !== undefined && pick(row.forecast) !== pick(final);
  const columns = [
    forecastHelper.accessor((r) => r.who, {
      id: "who",
      header: "Member",
      cell: ({ row }) => (
        <MemberName name={row.original.who} final={row.original.final} />
      ),
    }),
    forecastHelper.display({
      id: "usage",
      header: "Forecasted usage",
      cell: ({ row }) => (
        <Value overruled={overruled(row.original, (f) => cells(f).usage)}>{cells(row.original.forecast).usage}</Value>
      ),
    }),
    forecastHelper.display({
      id: "days",
      header: "Days",
      cell: ({ row }) => (
        <Value overruled={overruled(row.original, (f) => cells(f).days)}>{cells(row.original.forecast).days}</Value>
      ),
    }),
    forecastHelper.display({
      id: "change",
      header: "vs algorithmic",
      cell: ({ row }) =>
        row.original.forecast ? (
          <Value overruled={overruled(row.original, (f) => usageChange(f.usage_multiplier).short)}>
            {usageChange(row.original.forecast.usage_multiplier).short}
          </Value>
        ) : (
          "—"
        ),
    }),
    forecastHelper.display({
      id: "confidence",
      header: "Confidence",
      cell: ({ row }) => (
        <span className="font-mono">
          {row.original.forecast ? `${Math.round(row.original.forecast.confidence * 100)}%` : "—"}
        </span>
      ),
    }),
  ];
  return <DataTable compact columns={columns} data={rows} getRowId={(r) => r.who} />;
}

function ChairmanPanel({ cycle, ...context }: { cycle: CouncilCycle } & PanelContext) {
  const { chairman } = cycle;
  const articleId = chairman.verdicts?.length ? pickArticle(chairman.verdicts, context.picker.articleId) : null;
  const itemId = context.picker.itemId;
  return (
    <>
      <Section title={`Cycle ${cycle.cycle} chairman`}>
        <p className="text-sm text-strong-muted">{chairman.brief}</p>
        <Tokens tokensIn={chairman.tokensIn} tokensOut={chairman.tokensOut} />
        {chairman.error && chairman.called ? <Tag tone="red">{chairman.error}</Tag> : null}
      </Section>
      <Section title="Final decision">
        <CycleAnswer
          cycle={cycle.cycle}
          verdicts={chairman.verdicts}
          forecasts={chairman.forecasts}
          reasoningLabel="Chairman's reasoning"
          {...context}
        />
      </Section>
      <Section title="How each member answered">
        {cycle.cycle === 1 && articleId !== null ? <VerdictCompare cycle={cycle} articleId={articleId} /> : null}
        {cycle.cycle === 2 && itemId !== null ? (
          <ForecastCompare cycle={cycle} itemId={itemId} unit={context.lookups.unitOf(itemId)} />
        ) : null}
      </Section>
    </>
  );
}

function NewsPanel({ council }: { council: RunCouncil }) {
  return (
    <>
      <Section title="Sources">
        <ul className="flex flex-col gap-1 text-sm">
          {council.news.sources.map((s) => (
            <li key={s.name} className="flex justify-between gap-3">
              <span>
                {s.name} <span className="text-xs text-muted">Tier {s.tier} {"·"} {s.region ?? "Global"}</span>
              </span>
              <span className="font-mono">{s.fetched}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section title={`Articles fetched (${council.news.articles.length})`}>
        {council.news.articles.length === 0 ? (
          <p className="text-sm text-muted">No new articles in this run.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {council.news.articles.map((a) => (
              <li key={a.id} className="flex flex-col">
                <a href={a.url} target="_blank" rel="noreferrer" className="font-semibold text-navy underline-offset-2 hover:underline">
                  {a.title}
                </a>
                <span className="text-xs text-muted">
                  {a.source}
                  {a.publishedAt ? ` · ${formatShortDate(a.publishedAt.slice(0, 10))}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function ScreenerPanel({ council }: { council: RunCouncil }) {
  const screener = council.screener;
  if (!screener) return <p className="text-sm text-muted">The screener did not run.</p>;
  const selected = screener.articles.filter((a) => a.selected).length;
  return (
    <>
      <Section title="Screener">
        <p className="text-sm">
          <span className="font-semibold">{selected}</span> selected {"·"}{" "}
          <span className="font-semibold">{screener.articles.length - selected}</span> rejected
        </p>
        <Tokens tokensIn={screener.tokensIn} tokensOut={screener.tokensOut} />
      </Section>
      {screener.articles.map((a) => (
        <Section key={a.id} title={a.source}>
          <p className="text-sm font-semibold">{a.title}</p>
          <span className="flex flex-wrap gap-1.5">
            <Tag tone={a.selected ? "green" : "grey"}>{a.selected ? "Selected" : "Rejected"}</Tag>
            <ImpactTag impact={a.impactType} />
          </span>
          <TagList values={a.categories} />
          <Eyebrow>{a.selected ? "AI summary" : "AI: why it was rejected"}</Eyebrow>
          <p className="text-sm text-strong-muted">{a.selected ? a.summary : a.rejectReason}</p>
        </Section>
      ))}
    </>
  );
}

function AlgorithmicPanel({ council, lookups }: { council: RunCouncil; lookups: Lookups }) {
  const algo = council.algorithmic;
  if (!algo) return <p className="text-sm text-muted">No algorithmic forecast in this run.</p>;
  return (
    <Section title="Algorithmic forecast">
      <p className="text-sm">
        <span className="font-semibold">{algo.forecastCount}</span> items forecast
        {algo.stockAsOf ? ` · stock as of ${formatShortDate(algo.stockAsOf)}` : ""}
      </p>
      <Eyebrow>At or below threshold</Eyebrow>
      {algo.atOrBelowItemIds.length === 0 ? (
        <p className="text-sm text-muted">None.</p>
      ) : (
        <TagList values={algo.atOrBelowItemIds.map(lookups.itemName)} />
      )}
    </Section>
  );
}

type AiRow = RunCouncil["aiForecast"][number] & { name: string; unit: string };
const aiHelper = createTableColumnHelper<AiRow>();
const AI_COLUMNS = [
  aiHelper.accessor((r) => r.name, {
    id: "item",
    header: "Item",
    cell: ({ row }) => (
      <span className="flex flex-col items-start gap-1">
        {row.original.name}
        {row.original.triggered ? <Tag tone="red">Restock now</Tag> : null}
      </span>
    ),
  }),
  aiHelper.display({
    id: "usage",
    header: "Usage",
    cell: ({ row }) => (
      <span className="font-mono whitespace-nowrap">{outlookCells(row.original.outlook, row.original.unit).usage}</span>
    ),
  }),
  aiHelper.display({
    id: "days",
    header: "Days",
    cell: ({ row }) => (
      <span className="font-mono whitespace-nowrap">{outlookCells(row.original.outlook, row.original.unit).days}</span>
    ),
  }),
  aiHelper.accessor((r) => Math.abs((r.usageMultiplier ?? 1) - 1), {
    id: "change",
    header: "vs algo",
    cell: ({ row }) => {
      const change = usageChange(row.original.usageMultiplier ?? 1);
      return <Tag tone={change.tone}>{change.short}</Tag>;
    },
  }),
];

function AiPanel({ council, lookups }: { council: RunCouncil; lookups: Lookups }) {
  const rows = council.aiForecast
    .map((r) => ({ ...r, name: lookups.itemName(r.itemId), unit: lookups.unitOf(r.itemId) }))
    .sort((a, b) => Math.abs((b.usageMultiplier ?? 1) - 1) - Math.abs((a.usageMultiplier ?? 1) - 1));
  const changed = rows.filter((r) => usageChange(r.usageMultiplier ?? 1).pct !== 0).length;
  const restock = rows.filter((r) => r.triggered).length;
  return (
    <Section title="AI forecast">
      <p className="text-sm text-strong-muted">
        {changed} item{changed === 1 ? "" : "s"} changed from the algorithmic forecast, {restock} need
        {restock === 1 ? "s" : ""} restocking now.
      </p>
      <DataTable compact columns={AI_COLUMNS} data={rows} getRowId={(r) => String(r.itemId)} />
    </Section>
  );
}

function panelFor(nodeId: string, council: RunCouncil, context: PanelContext): React.ReactNode {
  if (nodeId === "algorithmic") return <AlgorithmicPanel council={council} lookups={context.lookups} />;
  if (nodeId === "news") return <NewsPanel council={council} />;
  if (nodeId === "screener") return <ScreenerPanel council={council} />;
  if (nodeId === "ai") return <AiPanel council={council} lookups={context.lookups} />;
  const match = /^c([12])-(member-(\d+)|members|review|chairman)$/.exec(nodeId);
  const cycle = match ? council.cycles.find((c) => c.cycle === Number(match[1])) : undefined;
  if (!match || !cycle) return <p className="text-sm text-muted">This step did not run.</p>;
  if (match[3]) return <MemberPanel cycle={cycle} seatId={Number(match[3])} {...context} />;
  if (match[2] === "review") return <ReviewPanel cycle={cycle} />;
  if (match[2] === "chairman") return <ChairmanPanel cycle={cycle} {...context} />;
  return <p className="text-sm text-muted">Pick a persona.</p>;
}

export function CouncilNodePanel({
  council,
  nodeId,
  itemId,
  onItemChange,
  onClose,
}: {
  council: RunCouncil;
  nodeId: string;
  itemId: number | null;
  onItemChange: (id: number) => void;
  onClose: () => void;
}) {
  const [articleId, setArticleId] = React.useState<number | null>(null);
  const itemById = new Map(council.items.map((i) => [i.id, i]));
  const titles = new Map(council.articles.map((a) => [a.id, a.title]));
  const lookups: Lookups = {
    itemName: (id) => itemById.get(id)?.name ?? `Item ${id}`,
    unitOf: (id) => itemById.get(id)?.unit ?? "units",
    articleTitle: (id) => titles.get(id) ?? `Article ${id}`,
  };
  const context: PanelContext = {
    picker: { articleId, setArticleId, itemId, setItemId: onItemChange },
    lookups,
    items: council.items,
  };

  return (
    <aside
      aria-label="Step details"
      className="flex w-full flex-col gap-3 motion-safe:animate-slide-in lg:max-h-160 lg:w-2/5 lg:shrink-0 lg:overflow-y-auto"
    >
      <div className="flex justify-end">
        <IconButton aria-label="Close step details" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>
      {panelFor(nodeId, council, context)}
    </aside>
  );
}
