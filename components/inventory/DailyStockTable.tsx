"use client";

import * as React from "react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { createTableColumnHelper } from "@/lib/table/features";
import type { DailyStock, DailyStockInput } from "@/lib/api/resources";

type QtyField = "received_qty" | "issued_qty" | "unmet_demand_qty" | "wastage_qty";
type Draft = Record<QtyField, string>;

const QTY_FIELDS: { field: QtyField; label: string }[] = [
  { field: "received_qty", label: "Received" },
  { field: "issued_qty", label: "Issued" },
  { field: "unmet_demand_qty", label: "Unmet" },
  { field: "wastage_qty", label: "Wastage" },
];

function toQty(value: string): number | null {
  if (value.trim() === "") return 0;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function toDraft(row: DailyStock): Draft {
  const text = (n: number | null) => (n === null ? "" : String(n));
  return {
    received_qty: text(row.received_qty),
    issued_qty: text(row.issued_qty),
    unmet_demand_qty: text(row.unmet_demand_qty),
    wastage_qty: text(row.wastage_qty),
  };
}

function previewClosing(row: DailyStock, draft: Draft): number | null {
  const [received, issued, wastage] = [draft.received_qty, draft.issued_qty, draft.wastage_qty].map(toQty);
  if (received === null || issued === null || wastage === null) return null;
  return row.opening_stock + received - issued - wastage;
}

type Editor = {
  editingId: number | null;
  draft: Draft;
  error: string | null;
  saving: boolean;
  setField: (field: QtyField, value: string) => void;
  start: (row: DailyStock) => void;
  cancel: () => void;
  save: () => void;
};

const EditorContext = React.createContext<Editor | null>(null);

function useEditor(): Editor {
  const editor = React.useContext(EditorContext);
  if (!editor) throw new Error("useEditor must be used within DailyStockTable");
  return editor;
}

function QtyCell({ row, field, label }: { row: DailyStock; field: QtyField; label: string }) {
  const editor = useEditor();
  if (editor.editingId !== row.item_id) {
    const value = row[field];
    return <span className="font-mono">{value === null ? "—" : value.toLocaleString()}</span>;
  }
  return (
    <div className="w-20">
      <Input
        type="number"
        inputMode="numeric"
        min="0"
        step="1"
        placeholder="0"
        aria-label={`${row.item_name} ${label.toLowerCase()}`}
        autoFocus={field === "received_qty"}
        disabled={editor.saving}
        value={editor.draft[field]}
        onChange={(e) => editor.setField(field, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") editor.save();
          if (e.key === "Escape") editor.cancel();
        }}
      />
    </div>
  );
}

function ClosingCell({ row }: { row: DailyStock }) {
  const editor = useEditor();
  const closing = editor.editingId === row.item_id ? previewClosing(row, editor.draft) : row.closing_stock;
  return (
    <span className={cn("font-mono font-semibold", closing !== null && closing < 0 && "text-red-dark")}>
      {closing === null ? "—" : closing.toLocaleString()}
    </span>
  );
}

function StatusCell({ row }: { row: DailyStock }) {
  if (!row.entered) return <Tag tone="dashed">Missing</Tag>;
  return (
    <span className="flex flex-wrap gap-1.5">
      <Tag tone="green">Entered</Tag>
      {row.stockout ? <Tag tone="red">Stockout</Tag> : null}
    </span>
  );
}

function ActionsCell({ row }: { row: DailyStock }) {
  const editor = useEditor();
  if (editor.editingId !== row.item_id) {
    return (
      <Button variant={row.entered ? "ghost" : "secondary"} onClick={() => editor.start(row)}>
        {row.entered ? "Edit" : "Enter"}
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={editor.saving} onClick={editor.save}>
          {editor.saving ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" disabled={editor.saving} onClick={editor.cancel}>
          Cancel
        </Button>
      </div>
      {editor.error ? (
        <p role="alert" className="max-w-xs text-xs text-red-dark">
          {editor.error}
        </p>
      ) : null}
    </div>
  );
}

const helper = createTableColumnHelper<DailyStock>();

const COLUMNS = [
  helper.accessor((r) => r.item_name, {
    id: "item",
    header: "Item",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-semibold">{row.original.item_name}</span>
        {row.original.unit ? <span className="text-xs text-muted">{row.original.unit}</span> : null}
      </div>
    ),
  }),
  helper.accessor((r) => r.opening_stock, {
    id: "opening",
    header: "Opening",
    cell: ({ row }) => <span className="font-mono">{row.original.opening_stock.toLocaleString()}</span>,
  }),
  ...QTY_FIELDS.map(({ field, label }) =>
    helper.display({
      id: field,
      header: label,
      cell: ({ row }) => <QtyCell row={row.original} field={field} label={label} />,
    }),
  ),
  helper.display({ id: "closing", header: "Closing", cell: ({ row }) => <ClosingCell row={row.original} /> }),
  helper.display({ id: "status", header: "Status", cell: ({ row }) => <StatusCell row={row.original} /> }),
  helper.display({ id: "actions", header: "Actions", cell: ({ row }) => <ActionsCell row={row.original} /> }),
];

const EMPTY_DRAFT: Draft = { received_qty: "", issued_qty: "", unmet_demand_qty: "", wastage_qty: "" };

export function DailyStockTable({
  rows,
  onSave,
}: {
  rows: DailyStock[];
  onSave: (input: DailyStockInput) => Promise<unknown>;
}) {
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [pendingRow, setPendingRow] = React.useState<DailyStock | null>(null);

  const editingRow = rows.find((r) => r.item_id === editingId) ?? null;
  const dirty = editingRow !== null && JSON.stringify(draft) !== JSON.stringify(toDraft(editingRow));

  const open = React.useCallback((row: DailyStock | null) => {
    setEditingId(row?.item_id ?? null);
    setDraft(row ? toDraft(row) : EMPTY_DRAFT);
    setError(null);
  }, []);

  const start = React.useCallback(
    (row: DailyStock) => {
      if (dirty) setPendingRow(row);
      else open(row);
    },
    [dirty, open],
  );

  const save = React.useCallback(async () => {
    if (!editingRow || saving) return;
    const qtys = QTY_FIELDS.map(({ field }) => toQty(draft[field]));
    if (qtys.some((q) => q === null)) {
      setError("Use whole numbers of 0 or more.");
      return;
    }
    const closing = previewClosing(editingRow, draft);
    if (closing !== null && closing < 0) {
      setError("Issued and wastage are more than the stock available.");
      return;
    }
    const [received_qty, issued_qty, unmet_demand_qty, wastage_qty] = qtys as number[];
    setSaving(true);
    setError(null);
    try {
      await onSave({
        item_id: editingRow.item_id,
        inventory_date: editingRow.inventory_date,
        received_qty,
        issued_qty,
        unmet_demand_qty,
        wastage_qty,
      });
      const nextMissing = rows.find((r) => !r.entered && r.item_id !== editingRow.item_id) ?? null;
      open(nextMissing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [draft, editingRow, onSave, open, rows, saving]);

  const editor = React.useMemo<Editor>(
    () => ({
      editingId,
      draft,
      error,
      saving,
      setField: (field, value) => setDraft((d) => ({ ...d, [field]: value })),
      start,
      cancel: () => open(null),
      save,
    }),
    [draft, editingId, error, open, save, saving, start],
  );

  return (
    <EditorContext.Provider value={editor}>
      <DataTable
        columns={COLUMNS}
        data={rows}
        getRowId={(r) => String(r.item_id)}
        emptyMessage="No items match your search."
      />
      <Modal
        open={pendingRow !== null}
        onOpenChange={(isOpen) => !isOpen && setPendingRow(null)}
        title="Discard unsaved changes?"
      >
        <p className="text-sm text-strong-muted">
          {editingRow?.item_name} has changes that are not saved yet.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            onClick={() => {
              open(pendingRow);
              setPendingRow(null);
            }}
          >
            Discard and continue
          </Button>
          <Button variant="ghost" onClick={() => setPendingRow(null)}>
            Keep editing
          </Button>
        </div>
      </Modal>
    </EditorContext.Provider>
  );
}
