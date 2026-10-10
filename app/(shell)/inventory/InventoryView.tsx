"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { SavedBanner, ConfirmDeleteBanner } from "@/components/ui/Banner";
import { ItemForm } from "@/components/inventory/ItemForm";
import { PurchaseOrderForm } from "@/components/inventory/PurchaseOrderForm";
import { SupplierForm } from "@/components/inventory/SupplierForm";
import { ItemsTable } from "@/components/inventory/ItemsTable";
import { PurchaseOrdersTable } from "@/components/inventory/PurchaseOrdersTable";
import { SuppliersTable } from "@/components/inventory/SuppliersTable";
import { useFacility } from "@/components/providers/FacilityProvider";
import { getItemRows, getPurchaseOrderRows, getSupplierRows } from "@/lib/data/inventory";
import type { ItemFormValues, PurchaseOrderFormValues, SupplierFormValues } from "@/lib/validation/inventory";
import * as api from "@/lib/api/resources";
import type { Item, PurchaseOrder, Supplier } from "@/lib/db/types";

type Panel =
  | { kind: "item"; mode: "add" }
  | { kind: "item"; mode: "edit"; id: number }
  | { kind: "item"; mode: "delete"; id: number }
  | { kind: "po"; mode: "add" }
  | { kind: "po"; mode: "edit"; id: number }
  | { kind: "po"; mode: "delete"; id: number }
  | { kind: "supplier"; mode: "add" }
  | { kind: "supplier"; mode: "edit"; id: number }
  | { kind: "supplier"; mode: "delete"; id: number };

export default function InventoryView() {
  const { facilityId } = useFacility();
  if (facilityId === null) return null;
  return <InventoryViewContent facilityId={facilityId} />;
}

function InventoryViewContent({ facilityId }: { facilityId: number }) {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [showSaved, setShowSaved] = React.useState(false);

  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });
  const suppliersQuery = useQuery({ queryKey: ["suppliers"], queryFn: api.getSuppliers });
  const poQuery = useQuery({
    queryKey: ["purchase-orders", facilityId],
    queryFn: () => api.getPurchaseOrders(facilityId),
  });
  const weeklyInventoryQuery = useQuery({
    queryKey: ["weekly-inventory", facilityId],
    queryFn: () => api.getWeeklyInventory(facilityId),
  });

  const items = itemsQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const purchaseOrders = poQuery.data ?? [];
  const weeklyInventory = weeklyInventoryQuery.data ?? [];

  function saved() {
    setPanel(null);
    setShowSaved(true);
  }

  const invalidateItems = () => qc.invalidateQueries({ queryKey: ["items"] });
  const invalidateSuppliers = () => qc.invalidateQueries({ queryKey: ["suppliers"] });
  const invalidatePOs = () => qc.invalidateQueries({ queryKey: ["purchase-orders", facilityId] });
  const invalidateWeekly = () => qc.invalidateQueries({ queryKey: ["weekly-inventory", facilityId] });

  const createItemMutation = useMutation({
    mutationFn: (input: Omit<Item, "item_id">) => api.createItem(input),
    onSuccess: () => {
      invalidateItems();
      saved();
    },
  });
  const updateItemMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Omit<Item, "item_id"> }) => api.updateItem(id, input),
    onSuccess: () => {
      invalidateItems();
      saved();
    },
  });
  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => api.deleteItem(id),
    onSuccess: invalidateItems,
  });
  const reorderLevelMutation = useMutation({
    mutationFn: ({ recordId, level }: { recordId: number; level: number }) =>
      api.updateReorderLevel(recordId, level),
    onSuccess: invalidateWeekly,
  });

  const createPoMutation = useMutation({
    mutationFn: (input: Omit<PurchaseOrder, "po_id">) => api.createPurchaseOrder(input),
    onSuccess: () => {
      invalidatePOs();
      saved();
    },
  });
  const updatePoMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Omit<PurchaseOrder, "po_id"> }) =>
      api.updatePurchaseOrder(id, input),
    onSuccess: () => {
      invalidatePOs();
      saved();
    },
  });
  const deletePoMutation = useMutation({
    mutationFn: (id: number) => api.deletePurchaseOrder(id),
    onSuccess: invalidatePOs,
  });

  const createSupplierMutation = useMutation({
    mutationFn: (input: Omit<Supplier, "supplier_id">) => api.createSupplier(input),
    onSuccess: () => {
      invalidateSuppliers();
      saved();
    },
  });
  const updateSupplierMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Omit<Supplier, "supplier_id"> }) =>
      api.updateSupplier(id, input),
    onSuccess: () => {
      invalidateSuppliers();
      saved();
    },
  });
  const deleteSupplierMutation = useMutation({
    mutationFn: (id: number) => api.deleteSupplier(id),
    onSuccess: invalidateSuppliers,
  });

  const itemRows = getItemRows(facilityId, items, weeklyInventory, suppliers);
  const filteredItemRows = itemRows.filter((r) =>
    r.item.item_name.toLowerCase().includes(search.toLowerCase()),
  );
  const poRows = getPurchaseOrderRows(facilityId, purchaseOrders, items, suppliers);
  const supplierRows = getSupplierRows(facilityId, suppliers, items, purchaseOrders);

  function handleItemSubmit(values: ItemFormValues) {
    const { reorder_level, ...rest } = values;
    const itemData = { ...rest, is_critical: (rest.is_critical ? 1 : 0) as 0 | 1 };
    if (panel?.kind === "item" && panel.mode === "edit") {
      updateItemMutation.mutate({ id: panel.id, input: itemData });
      const latestRecordId = itemRows.find((r) => r.item.item_id === panel.id)?.latestRecordId;
      if (reorder_level !== undefined && latestRecordId) {
        reorderLevelMutation.mutate({ recordId: latestRecordId, level: reorder_level });
      }
    } else {
      createItemMutation.mutate(itemData);
    }
  }

  function handlePoSubmit(values: PurchaseOrderFormValues) {
    const poData = {
      facility_id: facilityId,
      item_id: values.item_id,
      supplier_id: values.supplier_id,
      order_date: values.order_date,
      qty_ordered: values.qty_ordered,
      unit_cost_myr: values.unit_cost_myr,
      expected_receipt_date: values.expected_receipt_date,
      status: values.status,
      actual_receipt_date: values.status === "Delivered" ? (values.actual_receipt_date ?? null) : null,
      qty_received: values.status === "Delivered" ? (values.qty_received ?? null) : null,
    };
    if (panel?.kind === "po" && panel.mode === "edit") {
      updatePoMutation.mutate({ id: panel.id, input: poData });
    } else {
      createPoMutation.mutate(poData);
    }
  }

  function handleSupplierSubmit(values: SupplierFormValues) {
    const supplierData = {
      ...values,
      contact_name: values.contact_name || null,
      contact_email: values.contact_email || null,
      contact_phone: values.contact_phone || null,
    };
    if (panel?.kind === "supplier" && panel.mode === "edit") {
      updateSupplierMutation.mutate({ id: panel.id, input: supplierData });
    } else {
      createSupplierMutation.mutate(supplierData);
    }
  }

  function handleDeleteConfirm() {
    if (!panel || panel.mode !== "delete") return;
    if (panel.kind === "item") deleteItemMutation.mutate(panel.id);
    if (panel.kind === "po") deletePoMutation.mutate(panel.id);
    if (panel.kind === "supplier") deleteSupplierMutation.mutate(panel.id);
    setPanel(null);
  }

  const loadError = itemsQuery.error || suppliersQuery.error || poQuery.error || weeklyInventoryQuery.error;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Items, purchase orders and suppliers for this facility."
      />

      {loadError ? (
        <div className="rounded-md border border-red bg-red/5 p-4 text-sm text-red-dark">
          Could not load data from the database: {(loadError as Error).message}
        </div>
      ) : null}

      {showSaved ? <SavedBanner onDismiss={() => setShowSaved(false)} /> : null}

      {panel?.mode === "delete" ? (
        <ConfirmDeleteBanner
          label={deleteLabel(panel, itemRows, supplierRows)}
          onCancel={() => setPanel(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}

      {panel?.kind === "item" && panel.mode !== "delete" ? (
        <ItemForm
          mode={panel.mode}
          item={panel.mode === "edit" ? items.find((i) => i.item_id === panel.id) : undefined}
          previousReorderLevel={
            panel.mode === "edit"
              ? (itemRows.find((r) => r.item.item_id === panel.id)?.reorderLevel ?? null)
              : null
          }
          suppliers={suppliers}
          onCancel={() => setPanel(null)}
          onSubmit={handleItemSubmit}
        />
      ) : null}

      {panel?.kind === "po" && panel.mode !== "delete" ? (
        <PurchaseOrderForm
          mode={panel.mode}
          po={panel.mode === "edit" ? purchaseOrders.find((p) => p.po_id === panel.id) : undefined}
          facilityId={facilityId}
          items={items}
          suppliers={suppliers}
          weeklyInventory={weeklyInventory}
          onCancel={() => setPanel(null)}
          onSubmit={handlePoSubmit}
        />
      ) : null}

      {panel?.kind === "supplier" && panel.mode !== "delete" ? (
        <SupplierForm
          mode={panel.mode}
          supplier={
            panel.mode === "edit" ? suppliers.find((s) => s.supplier_id === panel.id) : undefined
          }
          onCancel={() => setPanel(null)}
          onSubmit={handleSupplierSubmit}
        />
      ) : null}

      <Tabs defaultValue="items" className="flex flex-col gap-5">
        <TabsList aria-label="Inventory views">
          <TabsTrigger value="items">Inventory and purchase orders</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="item-search" className="sr-only">
                  Search items
                </Label>
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <Input
                    id="item-search"
                    placeholder="Search items by name"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-64 pl-9"
                  />
                </div>
              </div>
              <Button variant="primary" onClick={() => setPanel({ kind: "item", mode: "add" })}>
                Add item
              </Button>
            </div>
            <ItemsTable
              rows={filteredItemRows}
              onEdit={(r) => setPanel({ kind: "item", mode: "edit", id: r.item.item_id })}
              onDelete={(r) => setPanel({ kind: "item", mode: "delete", id: r.item.item_id })}
            />
            <p className="text-xs text-muted">
              On-hand is the latest closing stock. Cover is on-hand divided by
              mean weekly issue over the last 6 weeks.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Purchase orders</h2>
              <Button variant="primary" onClick={() => setPanel({ kind: "po", mode: "add" })}>
                Add purchase order
              </Button>
            </div>
            <PurchaseOrdersTable
              rows={poRows}
              onEdit={(r) => setPanel({ kind: "po", mode: "edit", id: r.po.po_id })}
              onDelete={(r) => setPanel({ kind: "po", mode: "delete", id: r.po.po_id })}
            />
            <p className="text-xs text-muted">
              Orders in the database count as incoming stock in every forecast.
            </p>
          </section>
        </TabsContent>

        <TabsContent value="suppliers" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Suppliers</h2>
            <Button variant="primary" onClick={() => setPanel({ kind: "supplier", mode: "add" })}>
              Add supplier
            </Button>
          </div>
          <SuppliersTable
            rows={supplierRows}
            onEdit={(r) => setPanel({ kind: "supplier", mode: "edit", id: r.supplier.supplier_id })}
            onDelete={(r) => setPanel({ kind: "supplier", mode: "delete", id: r.supplier.supplier_id })}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function deleteLabel(
  panel: Extract<Panel, { mode: "delete" }>,
  itemRows: ReturnType<typeof getItemRows>,
  supplierRows: ReturnType<typeof getSupplierRows>,
): string {
  if (panel.kind === "item") {
    return itemRows.find((r) => r.item.item_id === panel.id)?.item.item_name ?? "this item";
  }
  if (panel.kind === "po") {
    return `PO-${panel.id}`;
  }
  return supplierRows.find((r) => r.supplier.supplier_id === panel.id)?.supplier.supplier_name ?? "this supplier";
}
