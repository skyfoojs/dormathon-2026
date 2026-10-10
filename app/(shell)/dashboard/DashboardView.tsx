"use client";

import * as React from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { PurchaseOrderStatusDonut } from "@/components/dashboard/PurchaseOrderStatusDonut";
import { AutomatedOrdersCard } from "@/components/dashboard/AutomatedOrdersCard";
import { ExpectedVsActualCard } from "@/components/dashboard/ExpectedVsActualCard";
import { AegiAvatar } from "@/components/dashboard/AegiAvatar";
import { useFacility } from "@/components/providers/FacilityProvider";
import * as api from "@/lib/api/resources";
import {
  accuracyTheme,
  KPI_ICON_PATHS,
  KPI_THEME,
  NO_DATA_THEME,
} from "@/lib/data/kpiStyle";
import { getPurchaseOrderRows, groupOrderRows } from "@/lib/data/inventory";
import {
  getExpectedVsActualSeries,
  getItemsWellStockedKpi,
  getPoDeliveredKpi,
  getPredictionAccuracyKpi,
  getProductAccuracy,
  getPurchaseOrderStatusBreakdown,
} from "@/lib/data/dashboardReports";
import { sampleExpectedVsActual, sampleProductAccuracy } from "@/lib/data/dashboardFallback";

const DEFAULT_CHART_ITEM_ID = 1; // Salbutamol 100mcg MDI inhaler

export default function DashboardView() {
  const { facilityId, facility } = useFacility();
  if (facilityId === null || facility === null) return null;
  return (
    <>
      <DashboardViewContent
        facilityId={facilityId}
        facilityName={facility.facility_name}
      />
      <AegiHost facilityId={facilityId} />
    </>
  );
}

// Mounted as a sibling of the main Dashboard content, not inside it, so Aegi
// jumps out as soon as the facility is known instead of waiting on every
// chart/table query there to resolve - and so she never unmounts/remounts
// when that content's own loading state changes.
function AegiHost({ facilityId }: { facilityId: number }) {
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId),
  });
  const pendingCount = (poQuery.data ?? []).filter((po) => po.status === "Pending").length;

  return <AegiAvatar pending={pendingCount} sample={false} reviewHref="/orders" />;
}

function DashboardViewContent({
  facilityId,
  facilityName,
}: {
  facilityId: number;
  facilityName: string;
}) {
  const [selectedItemId, setSelectedItemId] = React.useState<number>(
    DEFAULT_CHART_ITEM_ID,
  );
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: api.getSuppliers,
  });
  const weeklyInventoryQuery = useQuery({
    queryKey: ["weekly-inventory", facilityId],
    queryFn: () => api.getWeeklyInventory(facilityId),
  });
  const liveHazeQuery = useQuery({
    queryKey: ["haze-live"],
    queryFn: api.getLiveHaze,
  });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId),
  });
  const forecastsQuery = useQuery({
    queryKey: ["demand-forecasts", facilityId],
    queryFn: () => api.getDemandForecasts(facilityId),
  });

  const loading =
    itemsQuery.isLoading ||
    weeklyInventoryQuery.isLoading ||
    poQuery.isLoading ||
    forecastsQuery.isLoading;

  // Aegi mounts as soon as the facility is known (see the outer DashboardView
  // component), independent of this `loading` gate below, so she doesn't wait
  // on every chart/table query to resolve before jumping out.
  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <p className="text-sm text-muted">
          Loading data from the database{"…"}
        </p>
      </>
    );
  }

  const items = itemsQuery.data ?? [];
  const weeklyInventory = weeklyInventoryQuery.data ?? [];
  const liveHaze = liveHazeQuery.data ?? null;
  const purchaseOrders = poQuery.data ?? [];
  const forecasts = forecastsQuery.data ?? [];

  const poDelivered = getPoDeliveredKpi(purchaseOrders);
  const wellStocked = getItemsWellStockedKpi(weeklyInventory);

  const statusBreakdown = getPurchaseOrderStatusBreakdown(purchaseOrders);
  const orders = groupOrderRows(
    getPurchaseOrderRows(
      facilityId,
      purchaseOrders,
      items,
      suppliersQuery.data ?? [],
    ),
  );

  // Stored forecasts only become scoreable once their day has real recorded
  // usage; until at least one has, show clearly-tagged sample data.
  const realAccuracy = getProductAccuracy(forecasts, items);
  const forecastsAreSample = realAccuracy.length === 0;
  const productAccuracy = forecastsAreSample ? sampleProductAccuracy(items) : realAccuracy;
  const accuracyKpi = getPredictionAccuracyKpi(productAccuracy);

  const selectedItem = items.find((i) => i.item_id === selectedItemId);
  const selectedStats =
    productAccuracy.find((p) => p.itemId === selectedItemId) ?? null;
  const chartPoints = forecastsAreSample
    ? sampleExpectedVsActual(selectedItemId)
    : getExpectedVsActualSeries(forecasts, selectedItemId);

  const todayLine = `${format(new Date(), "EEEE d MMMM yyyy")} · ${facilityName}`;

  const poHasData = poDelivered.total > 0;
  const accuracyHasData = accuracyKpi.productCount > 0;
  const stockHasData = wellStocked.total > 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle={todayLine} />

      <section
        aria-label="Key indicators"
        className="mt-1 grid grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-3"
      >
        <DashboardKpiCard
          label="Air pollution index"
          provenance="public-evidence"
          value={liveHaze ? String(liveHaze.apiAvg) : "—"}
          sub={liveHaze ? liveHaze.category : "Live reading unavailable."}
          iconPath={KPI_ICON_PATHS.air}
          theme={liveHaze ? KPI_THEME.air : NO_DATA_THEME}
          delayMs={0}
        />
        <DashboardKpiCard
          label="Purchase orders delivered"
          provenance="database"
          value={
            poHasData ? `${poDelivered.delivered} of ${poDelivered.total}` : "—"
          }
          sub={
            poHasData
              ? `${poDelivered.total - poDelivered.delivered} still open`
              : "No sample data"
          }
          iconPath={KPI_ICON_PATHS.po}
          theme={poHasData ? KPI_THEME.po : NO_DATA_THEME}
          delayMs={80}
        />
        <DashboardKpiCard
          label="Prediction accuracy"
          provenance="synthetic-data"
          value={
            accuracyHasData ? `${accuracyKpi.meanAccuracy.toFixed(1)}%` : "—"
          }
          sub={
            accuracyHasData
              ? `All products, ${accuracyKpi.weeksScored} weeks`
              : "No sample data"
          }
          iconPath={KPI_ICON_PATHS.accuracy}
          theme={
            accuracyHasData
              ? accuracyTheme(accuracyKpi.meanAccuracy)
              : NO_DATA_THEME
          }
          delayMs={160}
        />
        <DashboardKpiCard
          label="Items well stocked"
          provenance="model-output"
          value={
            stockHasData
              ? `${wellStocked.wellStocked} of ${wellStocked.total}`
              : "—"
          }
          sub={
            stockHasData
              ? `${wellStocked.total - wellStocked.wellStocked} running low`
              : "No sample data"
          }
          iconPath={KPI_ICON_PATHS.stock}
          theme={stockHasData ? KPI_THEME.stock : NO_DATA_THEME}
          delayMs={240}
        />
      </section>

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-1">
          <PurchaseOrderStatusDonut breakdown={statusBreakdown} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <AutomatedOrdersCard orders={orders} />
        </div>
      </div>

      <ExpectedVsActualCard
        itemName={selectedItem?.item_name ?? "Item"}
        points={chartPoints}
        stats={selectedStats}
        products={productAccuracy}
        selectedItemId={selectedItemId}
        onSelectItem={setSelectedItemId}
        sample={forecastsAreSample}
      />
    </>
  );
}
