"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteBanner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { PoliciesTable } from "@/components/policies/PoliciesTable";
import { PolicyForm } from "@/components/policies/PolicyForm";
import * as api from "@/lib/api/resources";

type Panel =
  | { mode: "add" }
  | { mode: "edit"; id: number }
  | { mode: "delete"; id: number };

export default function PoliciesView() {
  const qc = useQueryClient();
  const [panel, setPanel] = React.useState<Panel | null>(null);

  const policiesQuery = useQuery({ queryKey: ["policies"], queryFn: api.getPolicies });
  const policies = policiesQuery.data ?? [];

  const invalidatePolicies = () => qc.invalidateQueries({ queryKey: ["policies"] });
  const closeAndRefresh = () => {
    invalidatePolicies();
    setPanel(null);
  };

  const createMutation = useMutation({ mutationFn: api.createPolicy, onSuccess: closeAndRefresh });
  const updateMutation = useMutation({
    mutationFn: ({ id, description }: { id: number; description: string }) => api.updatePolicy(id, description),
    onSuccess: closeAndRefresh,
  });
  const deleteMutation = useMutation({ mutationFn: api.deletePolicy, onSettled: invalidatePolicies });

  function handleSubmit(description: string) {
    if (panel?.mode === "edit") updateMutation.mutate({ id: panel.id, description });
    else createMutation.mutate(description);
  }

  function handleDeleteConfirm() {
    if (panel?.mode !== "delete") return;
    deleteMutation.mutate(panel.id);
    setPanel(null);
  }

  const editing = panel?.mode === "edit" ? policies.find((p) => p.policy_id === panel.id) : undefined;
  const formOpen = panel?.mode === "add" || (panel?.mode === "edit" && editing !== undefined);
  const error = policiesQuery.error || createMutation.error || updateMutation.error || deleteMutation.error;

  return (
    <>
      <PageHeader
        title="Policies"
        subtitle="Rules this facility wants followed, written in plain language."
        actions={
          <Button variant="primary" onClick={() => setPanel({ mode: "add" })}>
            <Plus size={16} aria-hidden="true" />
            Add policy
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="rounded-md border border-red bg-red/5 p-4 text-sm text-red-dark">
          Policies could not be loaded or saved. {(error as Error).message}
        </div>
      ) : null}

      {panel?.mode === "delete" ? (
        <ConfirmDeleteBanner
          label="this policy"
          onCancel={() => setPanel(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      <Modal
        open={formOpen}
        onOpenChange={(open) => !open && setPanel(null)}
        title={panel?.mode === "edit" ? "Edit policy" : "Add policy"}
      >
        {formOpen ? (
          <PolicyForm
            key={panel?.mode === "edit" ? panel.id : "add"}
            policy={editing}
            saving={createMutation.isPending || updateMutation.isPending}
            onCancel={() => setPanel(null)}
            onSubmit={handleSubmit}
          />
        ) : null}
      </Modal>

      {policiesQuery.isLoading ? (
        <p className="text-sm text-muted">Loading policies{"…"}</p>
      ) : (
        <PoliciesTable
          policies={policies}
          onEdit={(p) => setPanel({ mode: "edit", id: p.policy_id })}
          onDelete={(p) => setPanel({ mode: "delete", id: p.policy_id })}
        />
      )}
    </>
  );
}
