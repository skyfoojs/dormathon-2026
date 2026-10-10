"use client";

import { flexRender, useTable, type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { tableFeaturesConfig } from "@/lib/table/features";
import type { RowData, SortingState } from "@tanstack/table-core";

export function DataTable<T extends RowData>({
  columns,
  data,
  getRowId,
  emptyMessage = "Nothing to show.",
}: {
  // `any` here is the documented TanStack Table pattern for a generic table
  // wrapper: each column's cell value type varies, and the columns array is
  // heterogeneous, so TValue can't be narrowed from this component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<typeof tableFeaturesConfig, T, any>[];
  data: T[];
  getRowId?: (row: T) => string;
  emptyMessage?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useTable({
    features: tableFeaturesConfig,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-line bg-page">
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sortDir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-3 py-2.5 text-left font-mono text-xs font-medium tracking-wide text-muted uppercase"
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 rounded focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sortDir === "asc" ? (
                          <ArrowUp size={12} aria-hidden="true" />
                        ) : sortDir === "desc" ? (
                          <ArrowDown size={12} aria-hidden="true" />
                        ) : (
                          <ArrowUpDown size={12} aria-hidden="true" className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={cn("border-b border-line last:border-0 hover:bg-page")}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
