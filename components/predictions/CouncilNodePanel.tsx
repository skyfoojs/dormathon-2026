"use client";

import * as React from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Label, Select } from "@/components/ui/Input";
import { Tag } from "@/components/ui/Tag";
import { ItemSelect } from "@/components/predictions/ItemSelect";
import { createTableColumnHelper } from "@/lib/table/features";
import { formatShortDate } from "@/lib/data/dates";
import type {
  CouncilCycle,
  CouncilItemForecast,
  CouncilVerdict,
  RunCouncil,
} from "@/lib/api/resources";

type Lookups = { itemName: (id: number) => string; articleTitle: (id: number) => string };

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

function VerdictView({ verdict }: { verdict: CouncilVerdict }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <Tag tone={verdict.valid ? "green" : "red"}>{verdict.valid ? "Valid" : "Not valid"}</Tag>
        <Tag tone="amber">Severity {verdict.severity}/5</Tag>
        <Tag tone="blue">Impact: {verdict.impact_type}</Tag>
      </span>
      <TagList values={[...verdict.affected_categories, ...verdict.regions]} />
      <p className="text-sm text-strong-muted">{verdict.reasoning}</p>
    </div>
  );
}

function ForecastView({ forecast }: { forecast: CouncilItemForecast }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <Tag tone={forecast.usage_multiplier === 1 ? "grey" : "amber"}>×{forecast.usage_multiplier}</Tag>
        <Tag tone="blue">{forecast.fade_days === null ? "Lasts" : `Fades over ${forecast.fade_days} days`}</Tag>
        <Tag tone="grey">Confidence {Math.round(forecast.confidence * 100)}%</Tag>
      </span>
      <p className="text-sm text-strong-muted">{forecast.reasoning}</p>
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

function CycleAnswer({
  cycle,
  verdicts,
  forecasts,
  picker,
  lookups,
  items,
}: {
  cycle: 1 | 2;
  verdicts: CouncilVerdict[] | null;
  forecasts: CouncilItemForecast[] | null;
  picker: Picker;
  lookups: Lookups;
  items: { id: number; name: string }[];
}) {
  if (cycle === 1) {
    if (!verdicts?.length) return <p className="text-sm text-muted">No verdicts.</p>;
    const articleId = verdicts.some((v) => v.article_id === picker.articleId) ? picker.articleId : verdicts[0].article_id;
    const verdict = verdicts.find((v) => v.article_id === articleId);
    return (
      <>
        <ArticleSelect ids={verdicts.map((v) => v.article_id)} value={articleId} onChange={picker.setArticleId} lookups={lookups} />
        {verdict ? <VerdictView verdict={verdict} /> : null}
      </>
    );
  }
  if (!forecasts?.length) return <p className="text-sm text-muted">No forecasts.</p>;
  const forecast = forecasts.find((f) => f.item_id === picker.itemId);
  return (
    <>
      <ItemSelect id="panel-item" items={items} value={picker.itemId} onChange={picker.setItemId} />
      {forecast ? <ForecastView forecast={forecast} /> : <p className="text-sm text-muted">No answer for this item.</p>}
    </>
  );
}

function MemberPanel({ cycle, seatId, ...rest }: { cycle: CouncilCycle; seatId: number } & PanelContext) {
  const member = cycle.members.find((m) => m.seatId === seatId);
  if (!member) return null;
  return (
    <>
      <Section title={`Cycle ${cycle.cycle} persona`}>
        <p className="text-base font-semibold">
          {member.persona} <span className="font-mono text-sm text-muted">Response {member.label}</span>
        </p>
        <p className="text-sm text-strong-muted">{member.brief}</p>
        <Tokens tokensIn={member.tokensIn} tokensOut={member.tokensOut} />
        {member.error ? <Tag tone="red">Dropped: {member.error}</Tag> : null}
      </Section>
      <Section title={cycle.cycle === 1 ? "Verdict and thoughts" : "Multiplier and thoughts"}>
        <CycleAnswer cycle={cycle.cycle} verdicts={member.verdicts} forecasts={member.forecasts} {...rest} />
      </Section>
    </>
  );
}

const peerHelper = createTableColumnHelper<CouncilCycle["peerIndex"][number]>();
const PEER_COLUMNS = [
  peerHelper.accessor((r) => r.persona, {
    id: "persona",
    header: "Member",
    cell: ({ row }) => (
      <span>
        {row.original.persona} <span className="font-mono text-xs text-muted">{row.original.label}</span>
      </span>
    ),
  }),
  peerHelper.accessor((r) => r.index ?? -1, {
    id: "index",
    header: "Index",
    cell: ({ row }) => <span className="font-mono">{row.original.index ?? "—"}</span>,
  }),
  peerHelper.accessor((r) => r.agreement ?? -1, {
    id: "agreement",
    header: "Agrees",
    cell: ({ row }) => <span className="font-mono">{row.original.agreement === null ? "—" : `${row.original.agreement}%`}</span>,
  }),
];

function ReviewPanel({ cycle }: { cycle: CouncilCycle }) {
  return (
    <>
      <Section title="Peer review index">
        <p className="text-sm text-strong-muted">
          Index: average rank from the other members, 0 to 100 (100 = always ranked best). Agrees: how often the member matched the chairman.
        </p>
        <DataTable columns={PEER_COLUMNS} data={cycle.peerIndex} getRowId={(r) => r.label} />
      </Section>
      {cycle.reviews.map((r) => (
        <Section key={r.label} title={`${r.persona} (Response ${r.label}) reviews`}>
          <Tokens tokensIn={r.tokensIn} tokensOut={r.tokensOut} />
          {r.review ? (
            <>
              <p className="font-mono text-sm">Ranking: {r.review.ranking.join(" > ")}</p>
              {r.review.critiques.map((c) => (
                <details key={c.label} className="text-sm">
                  <summary className="cursor-pointer font-semibold">{c.label}</summary>
                  <p className="text-strong-muted">
                    <span className="font-medium text-green-text">Strengths: </span>
                    {c.strengths}
                  </p>
                  <p className="text-strong-muted">
                    <span className="font-medium text-red-dark">Concerns: </span>
                    {c.concerns}
                  </p>
                </details>
              ))}
            </>
          ) : (
            <Tag tone="red">{r.error ?? "No review"}</Tag>
          )}
        </Section>
      ))}
    </>
  );
}

function ChairmanPanel({ cycle, ...rest }: { cycle: CouncilCycle } & PanelContext) {
  const { chairman } = cycle;
  const compare = cycle.members.map((m) => {
    if (cycle.cycle === 1) {
      const articleId = rest.picker.articleId ?? chairman.verdicts?.[0]?.article_id;
      const v = m.verdicts?.find((x) => x.article_id === articleId);
      return { member: m, text: v ? `${v.valid ? "Valid" : "Not valid"}, severity ${v.severity}` : "—" };
    }
    const f = m.forecasts?.find((x) => x.item_id === rest.picker.itemId);
    return { member: m, text: f ? `×${f.usage_multiplier}` : "—" };
  });
  return (
    <>
      <Section title={`Cycle ${cycle.cycle} chairman`}>
        <p className="text-sm text-strong-muted">{chairman.brief}</p>
        <Tokens tokensIn={chairman.tokensIn} tokensOut={chairman.tokensOut} />
        {chairman.error ? <Tag tone="red">{chairman.error}</Tag> : null}
      </Section>
      <Section title="Final decision">
        <CycleAnswer cycle={cycle.cycle} verdicts={chairman.verdicts} forecasts={chairman.forecasts} {...rest} />
      </Section>
      <Section title="How each member answered">
        <ul className="flex flex-col gap-1 text-sm">
          {compare.map(({ member, text }) => (
            <li key={member.seatId} className="flex justify-between gap-3">
              <span>{member.persona}</span>
              <span className="font-mono">{text}</span>
            </li>
          ))}
        </ul>
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
            {a.impactType && a.impactType !== "none" ? <Tag tone="blue">Impact: {a.impactType}</Tag> : null}
          </span>
          <TagList values={[...a.categories, ...a.regions]} />
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

type AiRow = RunCouncil["aiForecast"][number] & { name: string };
const aiHelper = createTableColumnHelper<AiRow>();
const AI_COLUMNS = [
  aiHelper.accessor((r) => r.name, { id: "item", header: "Item" }),
  aiHelper.accessor((r) => r.usageMultiplier ?? 1, {
    id: "multiplier",
    header: "Multiplier",
    cell: ({ row }) => (
      <Tag tone={row.original.usageMultiplier === 1 ? "grey" : "amber"}>×{row.original.usageMultiplier ?? 1}</Tag>
    ),
  }),
  aiHelper.accessor((r) => (r.triggered ? 1 : 0), {
    id: "triggered",
    header: "Restock now",
    cell: ({ row }) => (row.original.triggered ? <Tag tone="red">Yes</Tag> : <span className="text-muted">No</span>),
  }),
  aiHelper.accessor((r) => r.buyQty ?? 0, {
    id: "buy",
    header: "Buy",
    cell: ({ row }) => <span className="font-mono">{Math.round(row.original.buyQty ?? 0).toLocaleString()}</span>,
  }),
];

function AiPanel({ council, lookups }: { council: RunCouncil; lookups: Lookups }) {
  const rows = council.aiForecast
    .map((r) => ({ ...r, name: lookups.itemName(r.itemId) }))
    .sort((a, b) => Math.abs((b.usageMultiplier ?? 1) - 1) - Math.abs((a.usageMultiplier ?? 1) - 1));
  return (
    <Section title="AI forecast">
      <p className="text-sm text-strong-muted">
        {rows.filter((r) => (r.usageMultiplier ?? 1) !== 1).length} items changed from the algorithmic forecast,{" "}
        {rows.filter((r) => r.triggered).length} need restocking now.
      </p>
      <DataTable columns={AI_COLUMNS} data={rows} getRowId={(r) => String(r.itemId)} />
    </Section>
  );
}

type PanelContext = { picker: Picker; lookups: Lookups; items: { id: number; name: string }[] };

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
  const itemNames = new Map(council.items.map((i) => [i.id, i.name]));
  const titles = new Map(council.articles.map((a) => [a.id, a.title]));
  const lookups: Lookups = {
    itemName: (id) => itemNames.get(id) ?? `Item ${id}`,
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
      className="flex w-full flex-col gap-3 motion-safe:animate-slide-in lg:max-h-128 lg:w-96 lg:shrink-0 lg:overflow-y-auto"
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
