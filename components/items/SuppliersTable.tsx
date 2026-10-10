"use client";

import { DataTable } from "@/components/ui/DataTable";
import { RowActions } from "@/components/items/RowActions";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { createTableColumnHelper } from "@/lib/table/features";
import type { SupplierRiskLevel, SupplierRow } from "@/lib/data/inventory";

const RISK_TONE: Record<SupplierRiskLevel, TagTone> = {
  "Late delivery": "red",
  Concentration: "amber",
  "Single source": "amber",
  Low: "green",
};

const helper = createTableColumnHelper<SupplierRow>();

export function SuppliersTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: SupplierRow[];
  onEdit: (row: SupplierRow) => void;
  onDelete: (row: SupplierRow) => void;
}) {
  const columns = [
    helper.accessor((r) => r.supplier.supplier_name, {
      id: "name",
      header: "Supplier",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.original.supplier.supplier_name}</span>
          <span className="text-xs text-muted">{row.original.supplier.contact_email ?? "—"}</span>
        </div>
      ),
    }),
    helper.accessor((r) => r.supplier.contact_name ?? "", {
      id: "contact",
      header: "Contact",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.supplier.contact_name ?? "—"}</span>
          <span className="text-xs text-muted">{row.original.supplier.contact_phone ?? "—"}</span>
        </div>
      ),
    }),
    helper.accessor((r) => r.supplier.lead_time_days, {
      id: "leadTime",
      header: "Lead time",
      cell: ({ row }) => <span className="font-mono">{row.original.supplier.lead_time_days} days</span>,
    }),
    helper.accessor((r) => r.itemsSupplied, {
      id: "itemsSupplied",
      header: "Items supplied",
      cell: ({ row }) => <span className="font-mono">{row.original.itemsSupplied}</span>,
    }),
    helper.accessor((r) => r.openPoCount, {
      id: "openPos",
      header: "Open POs",
      cell: ({ row }) => <span className="font-mono">{row.original.openPoCount}</span>,
    }),
    helper.display({
      id: "risk",
      header: "Risk",
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <Tag tone={RISK_TONE[row.original.risk.level]}>{row.original.risk.level}</Tag>
          <span className="text-xs text-muted">{row.original.risk.note}</span>
        </div>
      ),
    }),
    helper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          label={row.original.supplier.supplier_name}
          onEdit={() => onEdit(row.original)}
          onDelete={() => onDelete(row.original)}
        />
      ),
    }),
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => String(r.supplier.supplier_id)}
      emptyMessage="No suppliers yet."
    />
  );
}
