"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { StockChartCard } from "@/components/dashboard/StockChartCard";
import { ExternalSignalsCard } from "@/components/dashboard/ExternalSignalsCard";
import { TopWarningsCard } from "@/components/dashboard/TopWarningsCard";
import { RecentRunsCard } from "@/components/dashboard/RecentRunsCard";
import { useFacility } from "@/components/providers/FacilityProvider";
import { useWarnings } from "@/components/providers/WarningsProvider";
import * as api from "@/lib/api/resources";
import {
  getExternalSignals,
  getHazeKpi,
  getLowestCoverKpi,
  getOpenPurchaseOrdersKpi,
  getRecentPredictionRuns,
  getStockChartData,
} from "@/lib/data/dashboard";

const CHART_ITEM_ID = 1; // Salbutamol 100mcg MDI inhaler

export default function DashboardView() {
  const { facilityId } = useFacility();
  if (facilityId === null) return null;
  return <DashboardViewContent facilityId={facilityId} />;
}

function DashboardViewContent({ facilityId }: { facilityId: number }) {
  const { openWarnings } = useWarnings();

  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const weeklyInventoryQuery = useQuery({
    queryKey: ["weekly-inventory", facilityId],
    queryFn: () => api.getWeeklyInventory(facilityId),
  });
  const hazeQuery = useQuery({ queryKey: ["haze", facilityId], queryFn: () => api.getHaze(facilityId) });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId),
  });
  const liveHazeQuery = useQuery({
    queryKey: ["haze-live"],
    queryFn: api.getLiveHaze,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const items = itemsQuery.data ?? [];
  const weeklyInventory = weeklyInventoryQuery.data ?? [];
  const hazeRows = hazeQuery.data ?? [];
  const purchaseOrders = poQuery.data ?? [];
  const hasData = weeklyInventory.length > 0;
  const loading = itemsQuery.isLoading || weeklyInventoryQuery.isLoading || poQuery.isLoading;

  const facilityWarnings = openWarnings.filter((w) => w.facilityId === facilityId);
  const highCount = facilityWarnings.filter((w) => w.severity === "high").length;

  const haze = hasData ? getHazeKpi(hazeRows) : null;
  const lowestCover = hasData ? getLowestCoverKpi(weeklyInventory, items) : null;
  const openPOs = hasData ? getOpenPurchaseOrdersKpi(purchaseOrders) : null;
  const chartItem = items.find((i) => i.item_id === CHART_ITEM_ID);
  const chartData = hasData
    ? getStockChartData(
        weeklyInventory.filter((r) => r.item_id === CHART_ITEM_ID),
        purchaseOrders.filter((po) => po.item_id === CHART_ITEM_ID),
        hazeRows,
        chartItem,
      )
    : null;
  const signals = getExternalSignals(haze, liveHazeQuery.data ?? null);
  const runs = getRecentPredictionRuns(facilityId);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="What needs attention at this facility, and what is changing outside."
      />

      {loading ? (
        <p className="text-sm text-muted">Loading data from the database{"…"}</p>
      ) : (
        <>
          <section
            aria-label="Key indicators"
            className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4"
          >
            <KpiCard
              label="Haze API"
              provenance="database"
              value={haze ? String(haze.apiAvg) : "—"}
              sub={haze ? `${haze.category} this week` : "No readings for this facility."}
            />
            <KpiCard
              label="Open warnings"
              provenance="model-output"
              value={hasData ? String(facilityWarnings.length) : "—"}
              valueTone={highCount > 0 ? "red" : "default"}
              sub={
                hasData
                  ? highCount > 0
                    ? `${highCount} high severity`
                    : "No high-severity warnings"
                  : "No data for this facility."
              }
            />
            <KpiCard
              label="Lowest cover, critical item"
              provenance="model-output"
              value={lowestCover ? `${lowestCover.weeksOfCover} wks` : "—"}
              valueTone={
                lowestCover
                  ? lowestCover.weeksOfCover < 1
                    ? "red"
                    : lowestCover.weeksOfCover < 2
                      ? "amber"
                      : "default"
                  : "default"
              }
              sub={lowestCover ? lowestCover.itemName : "No critical items with cover data."}
            />
            <KpiCard
              label="Open purchase orders"
              provenance="database"
              value={openPOs ? String(openPOs.openCount) : "—"}
              valueTone={openPOs && openPOs.delayedCount > 0 ? "amber" : "default"}
              sub={
                openPOs
                  ? openPOs.delayedCount > 0
                    ? `${openPOs.delayedCount} delayed${openPOs.nextDueLabel ? `, next ${openPOs.nextDueLabel.toLowerCase()}` : ""}`
                    : openPOs.nextDueLabel
                      ? `Next ${openPOs.nextDueLabel.toLowerCase()}`
                      : "None open"
                  : "No data for this facility."
              }
            />
          </section>

          <div className="flex flex-wrap items-stretch gap-5">
            <StockChartCard data={chartData} />
            <ExternalSignalsCard signals={signals} />
          </div>

          <div className="flex flex-wrap items-stretch gap-5">
            <TopWarningsCard warnings={facilityWarnings} totalOpenCount={facilityWarnings.length} />
            <RecentRunsCard runs={runs} />
          </div>
        </>
      )}
    </>
  );
}
