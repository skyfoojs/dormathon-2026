"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { ProvenanceTag } from "@/components/ui/Tag";
import { PurchaseOrdersTable } from "@/components/inventory/PurchaseOrdersTable";
import { useFacility } from "@/components/providers/FacilityProvider";
import * as api from "@/lib/api/resources";
import { getPurchaseOrderRows } from "@/lib/data/inventory";

export function PurchaseOrdersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { facilityId } = useFacility();
  const enabled = open && facilityId !== null;

  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems, enabled });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: api.getSuppliers, enabled });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId as number),
    enabled,
  });

  const error = poQuery.error ?? itemsQuery.error ?? suppliersQuery.error;
  const loading = poQuery.isPending || itemsQuery.isPending || suppliersQuery.isPending;
  const rows =
    facilityId === null
      ? []
      : getPurchaseOrderRows(
          facilityId,
          (poQuery.data ?? []).filter((po) => po.status === "In transit"),
          itemsQuery.data ?? [],
          suppliersQuery.data ?? [],
        );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={
        <>
          Open purchase orders{" "}
          {loading || error ? null : <span className="font-mono text-sm font-normal text-muted">{rows.length}</span>}
        </>
      }
    >
      {error ? (
        <div className="rounded-md border border-red bg-red/5 p-4 text-sm text-red-dark">
          Could not load purchase orders: {(error as Error).message}
        </div>
      ) : loading ? (
        <p className="text-sm text-muted">Loading purchase orders{"…"}</p>
      ) : (
        <PurchaseOrdersTable rows={rows} />
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <ProvenanceTag kind="database" />
        <span>Orders still in transit for this facility. Status is read against today.</span>
      </div>
    </Modal>
  );
}
