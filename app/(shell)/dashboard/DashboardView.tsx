"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ReportStatusDonut } from "@/components/dashboard/ReportStatusDonut";
import { AutomatedOrdersCard } from "@/components/dashboard/AutomatedOrdersCard";
import { ExpectedVsActualCard } from "@/components/dashboard/ExpectedVsActualCard";
import { ReviewDialog } from "@/components/dashboard/ReviewDialog";
import { AllReportsDialog } from "@/components/dashboard/AllReportsDialog";
import { useFacility } from "@/components/providers/FacilityProvider";
import * as api from "@/lib/api/resources";
import { getPurchaseOrderRows, groupOrderRows } from "@/lib/data/inventory";
import {
  getExpectedVsActualSeries,
  getItemsWellStockedKpi,
  getPoDeliveredKpi,
  getPredictionAccuracyKpi,
  getProductAccuracy,
  getReportStatusBreakdown,
} from "@/lib/data/dashboardReports";
import {
  isSampleReportId,
  sampleExpectedVsActual,
  sampleProductAccuracy,
  sampleReports,
  sampleStatusBreakdown,
} from "@/lib/data/dashboardFallback";
import type { Report, ReportStatus } from "@/lib/db/types";

const DEFAULT_CHART_ITEM_ID = 1; // Salbutamol 100mcg MDI inhaler

export default function DashboardView() {
  const { facilityId, facility } = useFacility();
  if (facilityId === null) return null;
  return <DashboardViewContent facilityId={facilityId} facilityName={facility?.facility_name ?? ""} />;
}

function DashboardViewContent({ facilityId, facilityName }: { facilityId: number; facilityName: string }) {
  const qc = useQueryClient();
  const [selectedItemId, setSelectedItemId] = React.useState<number>(
    DEFAULT_CHART_ITEM_ID,
  );
  const [reviewing, setReviewing] = React.useState<Report | null>(null);
  const [allReportsOpen, setAllReportsOpen] = React.useState(false);
  const [allReportsFilter, setAllReportsFilter] = React.useState<
    "all" | ReportStatus
  >("all");

  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: api.getSuppliers });
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
  const reportsQuery = useQuery({
    queryKey: ["reports", facilityId],
    queryFn: () => api.getReports(facilityId),
  });
  const forecastsQuery = useQuery({
    queryKey: ["demand-forecasts", facilityId],
    queryFn: () => api.getDemandForecasts(facilityId),
  });

  const invalidateReports = () =>
    qc.invalidateQueries({ queryKey: ["reports", facilityId] });

  const approveMutation = useMutation({
    mutationFn: api.approveReport,
    onSuccess: invalidateReports,
  });
  const rejectMutation = useMutation({
    mutationFn: api.rejectReport,
    onSuccess: invalidateReports,
  });
  const retryMutation = useMutation({
    mutationFn: api.retryReport,
    onSuccess: invalidateReports,
  });
  const resetMutation = useMutation({
    mutationFn: () => api.seedReports(facilityId, true),
    onSuccess: invalidateReports,
  });

  const loading =
    itemsQuery.isLoading ||
    weeklyInventoryQuery.isLoading ||
    poQuery.isLoading ||
    reportsQuery.isLoading ||
    forecastsQuery.isLoading;

  // Seed reports once if this facility has none yet.
  React.useEffect(() => {
    if (
      reportsQuery.data &&
      reportsQuery.data.length === 0 &&
      !resetMutation.isPending
    ) {
      api.seedReports(facilityId).then(invalidateReports);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsQuery.data, facilityId]);

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
  const reports = reportsQuery.data ?? [];
  const forecasts = forecastsQuery.data ?? [];

  const poDelivered = getPoDeliveredKpi(purchaseOrders);
  const wellStocked = getItemsWellStockedKpi(weeklyInventory);

  // Both the reports workflow and the forecast backtest depend on tables
  // that may not be migrated yet (see dashboardFallback.ts). When either
  // comes back empty, fall back to clearly-tagged sample data instead of an
  // all-zero dashboard.
  const reportsAreSample = reports.length === 0;
  const effectiveReports = reportsAreSample ? sampleReports() : reports;
  const statusBreakdown = reportsAreSample
    ? sampleStatusBreakdown()
    : getReportStatusBreakdown(reports);
  const orders = groupOrderRows(
    getPurchaseOrderRows(facilityId, purchaseOrders, items, suppliersQuery.data ?? []),
  );

  const forecastsAreSample = forecasts.length === 0;
  const productAccuracy = forecastsAreSample
    ? sampleProductAccuracy(items)
    : getProductAccuracy(forecasts, items);
  const accuracyKpi = getPredictionAccuracyKpi(productAccuracy);

  const selectedItem = items.find((i) => i.item_id === selectedItemId);
  const selectedStats =
    productAccuracy.find((p) => p.itemId === selectedItemId) ?? null;
  const chartPoints = forecastsAreSample
    ? sampleExpectedVsActual(selectedItemId)
    : getExpectedVsActualSeries(forecasts, selectedItemId);

  return (
    <>
      <PageHeader title="Dashboard" />

      <section
        aria-label="Key indicators"
        className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4"
      >
        <KpiCard
          label="Air pollution index"
          provenance="public-evidence"
          value={liveHaze ? String(liveHaze.apiAvg) : "—"}
          sub={
            liveHaze
              ? `${liveHaze.category} · ${liveHaze.locationLabel}`
              : "Live reading unavailable."
          }
        />
        <KpiCard
          label="Purchase orders delivered"
          provenance="database"
          value={`${poDelivered.delivered} of ${poDelivered.total}`}
          valueTone="green"
          sub={`${poDelivered.total - poDelivered.delivered} still open`}
        />
        <KpiCard
          label="Prediction accuracy"
          provenance="synthetic-data"
          value={
            accuracyKpi.productCount > 0
              ? `${accuracyKpi.meanAccuracy.toFixed(1)}%`
              : "—"
          }
          valueTone={
            accuracyKpi.meanAccuracy >= 90
              ? "green"
              : accuracyKpi.meanAccuracy >= 80
                ? "amber"
                : "red"
          }
          sub={
            accuracyKpi.productCount > 0
              ? `All products, ${accuracyKpi.weeksScored} weeks`
              : "Not enough history yet"
          }
        />
        <KpiCard
          label="Items well stocked"
          provenance="model-output"
          value={`${wellStocked.wellStocked} of ${wellStocked.total}`}
          sub={`${wellStocked.total - wellStocked.wellStocked} running low`}
        />
      </section>

      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-1">
          <ReportStatusDonut
            breakdown={statusBreakdown}
            sample={reportsAreSample}
            onSelectStatus={(status) => {
              setAllReportsFilter(status);
              setAllReportsOpen(true);
            }}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <AutomatedOrdersCard orders={orders} facilityName={facilityName} />
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

      <ReviewDialog
        report={reviewing}
        open={reviewing !== null}
        onOpenChange={(open) => !open && setReviewing(null)}
        onApprove={(id) => {
          if (!isSampleReportId(id)) approveMutation.mutate(id);
          setReviewing(null);
        }}
        onReject={(id) => {
          if (!isSampleReportId(id)) rejectMutation.mutate(id);
          setReviewing(null);
        }}
        onRetry={(id) => {
          if (!isSampleReportId(id)) retryMutation.mutate(id);
          setReviewing(null);
        }}
        backLabel={allReportsOpen ? "Back to all reports" : "Close"}
      />

      <AllReportsDialog
        open={allReportsOpen}
        onOpenChange={setAllReportsOpen}
        reports={effectiveReports}
        initialFilter={allReportsFilter}
        onReview={(r) => {
          setAllReportsOpen(false);
          setReviewing(r);
        }}
      />
    </>
  );
}
