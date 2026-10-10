"use client";

import { DataTable } from "@/components/ui/DataTable";
import { RowActions } from "@/components/items/RowActions";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { createTableColumnHelper } from "@/lib/table/features";
import { coverTone, type ItemRow } from "@/lib/data/inventory";

const helper = createTableColumnHelper<ItemRow>();

export function ItemsTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: ItemRow[];
  onEdit: (row: ItemRow) => void;
  onDelete: (row: ItemRow) => void;
}) {
  const columns = [
    helper.accessor((r) => r.item.item_name, {
      id: "item",
      header: "Item",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.original.item.item_name}</span>
          <span className="text-xs text-muted">
            {row.original.item.category} {"·"} {row.original.item.unit}
          </span>
        </div>
      ),
    }),
    helper.accessor((r) => (r.item.is_critical ? "Critical" : "Standard"), {
      id: "class",
      header: "Class",
      cell: ({ row }) => (
        <Tag tone={row.original.item.is_critical ? "navy" : "grey"}>
          {row.original.item.is_critical ? "Critical" : "Standard"}
        </Tag>
      ),
    }),
    helper.accessor((r) => r.onHand ?? -1, {
      id: "onHand",
      header: "On-hand",
      cell: ({ row }) => <span className="font-mono">{row.original.onHand ?? "—"}</span>,
    }),
    helper.accessor((r) => r.coverWeeks ?? -1, {
      id: "cover",
      header: "Cover",
      cell: ({ row }) => {
        const weeks = row.original.coverWeeks;
        const tone = coverTone(weeks);
        return (
          <span
            className={cn("font-mono", tone === "red" && "text-red", tone === "amber" && "text-amber-text")}
          >
            {weeks === null ? "—" : `${weeks} wks`}
          </span>
        );
      },
    }),
    helper.accessor((r) => r.reorderLevel ?? -1, {
      id: "reorderLevel",
      header: "Reorder level",
      cell: ({ row }) => <span className="font-mono">{row.original.reorderLevel ?? "Auto"}</span>,
    }),
    helper.accessor((r) => r.supplierName, {
      id: "supplier",
      header: "Supplier",
    }),
    helper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          label={row.original.item.item_name}
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
      getRowId={(r) => String(r.item.item_id)}
      emptyMessage="No items match your search."
    />
  );
}
