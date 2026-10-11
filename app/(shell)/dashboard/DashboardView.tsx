"use client";

import * as React from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardKpiCard } from "@/components/dashboard/DashboardKpiCard";
import { StatusDonut, type StatusDonutSegment } from "@/components/dashboard/StatusDonut";
import { AutomatedOrdersCard } from "@/components/dashboard/AutomatedOrdersCard";
import { PredictionAccuracyCard } from "@/components/dashboard/PredictionAccuracyCard";
import { AegiAvatar } from "@/components/dashboard/AegiAvatar";
import { useFacility } from "@/components/providers/FacilityProvider";
import * as api from "@/lib/api/resources";
import { formatShortDate } from "@/lib/data/dates";
import { buildOverallAccuracy } from "@/lib/forecast/accuracy";
import {
  accuracyTheme,
  KPI_ICON_PATHS,
  KPI_THEME,
  NO_DATA_THEME,
} from "@/lib/data/kpiStyle";
import { getPurchaseOrderRows, groupOrderRows } from "@/lib/data/inventory";
import {
  getItemsWellStockedKpi,
  getPoDeliveredKpi,
  getPredictionAccuracyKpi,
} from "@/lib/data/dashboardReports";
import type { OrderRow } from "@/lib/data/inventory";
import type { PurchaseOrderStatus } from "@/lib/db/types";

// The order statuses in the order an order moves through them, with the
// colour each one takes on the status chart.
const ORDER_STATUS_SEGMENTS: { status: PurchaseOrderStatus; colorVar: string; dotClass: string }[] = [
  { status: "Pending", colorVar: "var(--color-violet-text)", dotClass: "bg-violet-text" },
  { status: "In transit", colorVar: "var(--color-blue-light)", dotClass: "bg-blue-light" },
  { status: "Delivered", colorVar: "var(--color-green-text)", dotClass: "bg-green-text" },
  { status: "Cancelled", colorVar: "var(--color-line-strong)", dotClass: "bg-line-strong" },
];

function getOrderStatusSegments(orders: OrderRow[]): StatusDonutSegment[] {
  return ORDER_STATUS_SEGMENTS.map(({ status, colorVar, dotClass }) => ({
    key: status,
    label: status,
    count: orders.filter((o) => o.po.status === status).length,
    colorVar,
    dotClass,
  }));
}


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
  // Count orders, not lines: the rows of one PO document share a po_doc_id
  // and the Orders page shows them as a single order, so Aegi must too.
  const pendingCount = new Set(
    (poQuery.data ?? [])
      .filter((po) => po.status === "Pending")
      .map((po) => po.po_doc_id ?? `po:${po.po_id}`),
  ).size;

  return <AegiAvatar pending={pendingCount} sample={false} reviewHref="/orders" />;
}

function DashboardViewContent({
  facilityId,
  facilityName,
}: {
  facilityId: number;
  facilityName: string;
}) {
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: api.getSuppliers,
  });
  const stockStatusQuery = useQuery({
    queryKey: ["stock-status"],
    queryFn: api.getStockStatus,
  });
  const hazeQuery = useQuery({
    queryKey: ["haze"],
    queryFn: api.getHaze,
  });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId),
  });
  const accuracyQuery = useQuery({
    queryKey: ["forecast-accuracy"],
    queryFn: api.getForecastAccuracy,
  });

  const loading =
    itemsQuery.isLoading ||
    stockStatusQuery.isLoading ||
    poQuery.isLoading ||
    accuracyQuery.isLoading;

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
  const haze = hazeQuery.data?.latest ?? null;
  const purchaseOrders = poQuery.data ?? [];

  const poDelivered = getPoDeliveredKpi(purchaseOrders);
  const wellStocked = getItemsWellStockedKpi(stockStatusQuery.data ?? []);

  const orders = groupOrderRows(
    getPurchaseOrderRows(
      facilityId,
      purchaseOrders,
      items,
      suppliersQuery.data ?? [],
    ),
  );

  // Real weekly accuracy, scored against recorded usage (lib/forecast/accuracy.ts).
  const productAccuracy = accuracyQuery.data ?? [];
  const accuracyKpi = getPredictionAccuracyKpi(productAccuracy);
  const overallAccuracy = buildOverallAccuracy(productAccuracy);

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
          value={haze ? String(haze.aqi) : "—"}
          sub={haze ? `${haze.category} · ${formatShortDate(haze.date)}` : "No haze reading yet."}
          iconPath={KPI_ICON_PATHS.air}
          theme={haze ? KPI_THEME.air : NO_DATA_THEME}
          delayMs={0}
        />
        <DashboardKpiCard
          label="Purchase orders delivered"
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
          <StatusDonut
            title="Purchase order status"
            unitLabel="Orders"
            segments={getOrderStatusSegments(orders)}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <AutomatedOrdersCard orders={orders} />
        </div>
      </div>

      <PredictionAccuracyCard overall={overallAccuracy} />
    </>
  );
}
