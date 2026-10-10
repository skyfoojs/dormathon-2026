"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/SearchInput";
import { SavedBanner, ConfirmDeleteBanner, ErrorBanner } from "@/components/ui/Banner";
import { ItemForm } from "@/components/items/ItemForm";
import { SupplierForm } from "@/components/items/SupplierForm";
import { ItemsTable } from "@/components/items/ItemsTable";
import { SuppliersTable } from "@/components/items/SuppliersTable";
import { useFacility } from "@/components/providers/FacilityProvider";
import { getItemRows, getSupplierRows } from "@/lib/data/inventory";
import type { ItemFormValues, SupplierFormValues } from "@/lib/validation/inventory";
import * as api from "@/lib/api/resources";
import type { Item, Supplier } from "@/lib/db/types";

type Panel =
  | { kind: "item"; mode: "add" }
  | { kind: "item"; mode: "edit"; id: number }
  | { kind: "item"; mode: "delete"; id: number }
  | { kind: "supplier"; mode: "add" }
  | { kind: "supplier"; mode: "edit"; id: number }
  | { kind: "supplier"; mode: "delete"; id: number };

export default function ItemsView() {
  const { facilityId } = useFacility();
  if (facilityId === null) return null;
  return <ItemsViewContent facilityId={facilityId} />;
}

function ItemsViewContent({ facilityId }: { facilityId: number }) {
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
    if (panel.kind === "supplier") deleteSupplierMutation.mutate(panel.id);
    setPanel(null);
  }

  const loadError = itemsQuery.error || suppliersQuery.error || poQuery.error || weeklyInventoryQuery.error;

  return (
    <>
      <PageHeader
        title="Items"
        subtitle="Items and suppliers for this facility. Purchase orders are on the Orders page."
      />

      {loadError ? (
        <ErrorBanner>
          Could not load data from the database: {(loadError as Error).message}
        </ErrorBanner>
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
        <TabsList aria-label="Items views">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput
              id="item-search"
              label="Search items"
              placeholder="Search items by name"
              value={search}
              onChange={setSearch}
            />
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
  return supplierRows.find((r) => r.supplier.supplier_id === panel.id)?.supplier.supplier_name ?? "this supplier";
}
