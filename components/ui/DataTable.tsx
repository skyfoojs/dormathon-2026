"use client";

import { flexRender, useTable, type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { tableFeaturesConfig } from "@/lib/table/features";
import type { RowData, SortingState } from "@tanstack/table-core";

export function DataTable<T extends RowData>({
  columns,
  data,
  getRowId,
  emptyMessage = "Nothing to show.",
  pageSize,
  compact = false,
}: {
  // `any` here is the documented TanStack Table pattern for a generic table
  // wrapper: each column's cell value type varies, and the columns array is
  // heterogeneous, so TValue can't be narrowed from this component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<typeof tableFeaturesConfig, T, any>[];
  data: T[];
  getRowId?: (row: T) => string;
  emptyMessage?: string;
  // When set, rows are shown this many at a time with previous/next controls.
  pageSize?: number;
  compact?: boolean;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [page, setPage] = React.useState(0);

  const table = useTable({
    features: tableFeaturesConfig,
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  const sortedRows = table.getRowModel().rows;
  const pageCount = pageSize ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  // Clamp instead of resetting state, so the page stays valid when rows are filtered away.
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = pageSize
    ? sortedRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
    : sortedRows;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-line">
        <table className={cn("w-full border-collapse text-sm", !compact && "min-w-max")}>
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
                      className={cn(
                        "text-left font-mono text-xs font-medium tracking-wide text-muted uppercase",
                        compact ? "px-2 py-2" : "px-3 py-2.5",
                      )}
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
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id} className={cn("border-b border-line last:border-0 hover:bg-page")}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className={cn("align-middle", compact ? "px-2 py-2" : "px-3 py-2.5")}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pageSize && pageCount > 1 ? (
        <div className="flex items-center justify-end gap-3">
          <span className="font-mono text-xs text-muted" aria-live="polite">
            Page {currentPage + 1} of {pageCount}
          </span>
          <IconButton
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </IconButton>
          <IconButton
            aria-label="Next page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}
