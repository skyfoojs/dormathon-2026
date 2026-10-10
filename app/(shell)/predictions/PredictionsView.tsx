"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { LastSyncCard } from "@/components/predictions/LastSyncCard";
import { RunTilesSection } from "@/components/predictions/RunTiles";
import { AllRunsModal } from "@/components/predictions/AllRunsModal";
import { RunDetail } from "@/components/predictions/RunDetail";
import { SourcesAndChanges } from "@/components/predictions/SourcesAndChanges";
import { SuggestedStockTable } from "@/components/predictions/SuggestedStockTable";
import { usePredictions } from "@/components/providers/PredictionsProvider";
import { getRunDetail } from "@/lib/mock/predictionDetail";

export default function PredictionsView() {
  const { runs, selectedRunId, selectRun, syncNow } = usePredictions();
  const [modalOpen, setModalOpen] = React.useState(false);

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? runs[0];
  const detail = getRunDetail(selectedRun.id) ?? getRunDetail(runs[0].id)!;

  return (
    <>
      <PageHeader
        title="Predictions"
        subtitle="When the models last read the outside world, what each one found, and what they suggest."
      />

      <LastSyncCard latestRun={runs[0]} onSyncNow={syncNow} />

      <RunTilesSection
        runs={runs}
        totalToday={runs.length}
        selectedRunId={selectedRun.id}
        onSelect={selectRun}
        onViewAll={() => setModalOpen(true)}
      />

      <AllRunsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        runs={runs}
        onOpenRun={(id) => {
          selectRun(id);
          setModalOpen(false);
        }}
      />

      <RunDetail key={selectedRun.id} run={selectedRun} detail={detail} />

      <SourcesAndChanges detail={detail} />

      <SuggestedStockTable rows={detail.suggestedStock} />
    </>
  );
}
