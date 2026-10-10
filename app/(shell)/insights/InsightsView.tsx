"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AnalysisCard } from "@/components/insights/AnalysisCard";
import { HazeDemandScatterChart } from "@/components/insights/HazeDemandScatterChart";
import { UnusualWeeksChart } from "@/components/insights/UnusualWeeksChart";
import { ReceiptsVsOrdersChart } from "@/components/insights/ReceiptsVsOrdersChart";
import { CoverByItemChart } from "@/components/insights/CoverByItemChart";
import { RelationshipGraph } from "@/components/insights/RelationshipGraph";
import { FindingsList } from "@/components/insights/FindingsList";
import { useFacility } from "@/components/providers/FacilityProvider";
import * as api from "@/lib/api/resources";
import {
  getCoverByItem,
  getFindings,
  getHazeDemandSeries,
  getKeyFigures,
  getReceiptsVsOrders,
  getRelationshipGraph,
  getUnusualWeeks,
  type InsightsDataset,
} from "@/lib/data/insights";

export default function InsightsView() {
  const { facilityId, facility } = useFacility();
  if (facilityId === null || !facility) return null;
  return <InsightsViewContent facilityId={facilityId} facilityName={facility.facility_name} />;
}

function InsightsViewContent({ facilityId, facilityName }: { facilityId: number; facilityName: string }) {
  const [lastAnalysed, setLastAnalysed] = React.useState("09:14");
  const [running, setRunning] = React.useState(false);

  const weeklyInventoryQuery = useQuery({
    queryKey: ["weekly-inventory", facilityId],
    queryFn: () => api.getWeeklyInventory(facilityId),
  });
  const hazeQuery = useQuery({ queryKey: ["haze", facilityId], queryFn: () => api.getHaze(facilityId) });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId),
  });
  const batchesQuery = useQuery({ queryKey: ["batches", facilityId], queryFn: () => api.getBatches(facilityId) });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: api.getSuppliers });

  const loading =
    weeklyInventoryQuery.isLoading ||
    hazeQuery.isLoading ||
    poQuery.isLoading ||
    batchesQuery.isLoading ||
    itemsQuery.isLoading ||
    suppliersQuery.isLoading;

  function runAnalysis() {
    setRunning(true);
    setTimeout(() => {
      const now = new Date();
      setLastAnalysed(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setRunning(false);
    }, 600);
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Insights" subtitle="Patterns across the database, including ones worth a second look." />
        <p className="text-sm text-muted">Loading data from the database{"…"}</p>
      </>
    );
  }

  const data: InsightsDataset = {
    weeklyInventory: weeklyInventoryQuery.data ?? [],
    hazeRows: hazeQuery.data ?? [],
    purchaseOrders: poQuery.data ?? [],
    batches: batchesQuery.data ?? [],
    items: itemsQuery.data ?? [],
    suppliers: suppliersQuery.data ?? [],
    facilityName,
  };

  const findings = getFindings(data);
  const keyFigures = getKeyFigures(data, { concerning: findings.filter((f) => f.category === "concerning").length });
  const hazeDemand = getHazeDemandSeries(data);
  const unusualWeeks = getUnusualWeeks(data);
  const receiptsVsOrders = getReceiptsVsOrders(data);
  const coverByItem = getCoverByItem(data);
  const relationshipGraph = getRelationshipGraph(data);

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="Patterns across the database, including ones worth a second look."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">Last analysed {lastAnalysed} today</span>
            <Button variant="primary" onClick={runAnalysis} disabled={running}>
              {running ? "Analysing…" : "Run analysis"}
            </Button>
          </div>
        }
      />

      <section aria-label="Key figures" className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
        <KpiCard
          label="Series scanned"
          provenance="database"
          value={String(keyFigures.seriesScanned)}
          sub="Items with weekly history at this facility."
        />
        <KpiCard
          label="Concerning flags"
          provenance="model-output"
          value={String(keyFigures.concerningFlags)}
          valueTone={keyFigures.concerningFlags > 0 ? "amber" : "default"}
          sub="Findings worth checking in this run."
        />
        <KpiCard
          label="Haze-to-demand correlation"
          provenance="model-output"
          value={`r = ${keyFigures.hazeCorrelation.toFixed(2)}`}
          sub="Pearson correlation, weekly haze API vs units issued."
        />
        <KpiCard
          label="Receipts matched to orders"
          provenance="model-output"
          value={`${Math.round(keyFigures.receiptsMatchedShare * 100)}%`}
          sub="Share of received stock linked to a purchase order."
        />
      </section>

      {data.weeklyInventory.length === 0 ? (
        <p className="text-sm text-muted">No weekly history for this facility yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AnalysisCard
              question="Does haze drive demand?"
              caption="Weekly haze API average against weekly units issued, with a fitted line."
              takeawayLead={`r = ${hazeDemand.r.toFixed(2)}.`}
              takeawayRest={
                Math.abs(hazeDemand.r) > 0.4
                  ? "Haze shows a usable link to demand in this sample."
                  : "Haze shows a weak link to demand in this sample so far."
              }
              provenance={["database", "model-output"]}
              summary={`Scatter of ${hazeDemand.points.length} weeks, haze API against units issued, correlation r equals ${hazeDemand.r.toFixed(2)}.`}
            >
              <HazeDemandScatterChart points={hazeDemand.points} fit={hazeDemand.fit} />
            </AnalysisCard>

            <AnalysisCard
              question="Are any weeks unusual?"
              caption="Weekly total issued quantity with the mean and a 2 standard deviation band."
              takeawayLead={
                unusualWeeks.points.some((p) => p.isOutlier)
                  ? `${unusualWeeks.points.filter((p) => p.isOutlier).length} week(s) fall outside the band.`
                  : "No weeks fall outside the band."
              }
              takeawayRest="Points outside the shaded band are more than 2 standard deviations from the mean."
              provenance={["database", "model-output"]}
              summary={`Weekly issued quantity across ${unusualWeeks.points.length} weeks, mean ${Math.round(unusualWeeks.mean)}, standard deviation ${Math.round(unusualWeeks.stdDev)}.`}
            >
              <UnusualWeeksChart points={unusualWeeks.points} mean={unusualWeeks.mean} stdDev={unusualWeeks.stdDev} />
            </AnalysisCard>

            <AnalysisCard
              question="Do receipts match orders?"
              caption="Weekly received units; receipts with no linked purchase order are amber."
              takeawayLead={`${Math.round(receiptsVsOrders.matchedShare * 100)}% matched.`}
              takeawayRest="The remainder is received stock with no linked purchase order receipt in the same week."
              provenance={["database", "model-output"]}
              summary={`Weekly received units over ${receiptsVsOrders.bars.length} weeks, ${Math.round(receiptsVsOrders.matchedShare * 100)} percent matched to a purchase order.`}
            >
              <ReceiptsVsOrdersChart bars={receiptsVsOrders.bars} />
            </AnalysisCard>

            <AnalysisCard
              question="Which items are closest to running out?"
              caption="Weeks of cover per item, with a 2-week threshold."
              takeawayLead={
                coverByItem[0]
                  ? `${coverByItem[0].itemName} has the lowest cover at ${coverByItem[0].weeksOfCover} weeks.`
                  : "No cover data available."
              }
              takeawayRest="Bars under 1 week are red, under 2 weeks are amber."
              provenance={["database", "model-output"]}
              summary={`Weeks of cover for ${coverByItem.length} items, lowest is ${coverByItem[0]?.itemName ?? "none"} at ${coverByItem[0]?.weeksOfCover ?? 0} weeks.`}
            >
              <CoverByItemChart rows={coverByItem} />
            </AnalysisCard>
          </div>

          <RelationshipGraph nodes={relationshipGraph.nodes} links={relationshipGraph.links} />

          <FindingsList findings={findings} />
        </>
      )}
    </>
  );
}
