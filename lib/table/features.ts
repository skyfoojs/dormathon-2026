import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { RowData } from "@tanstack/table-core";

// @tanstack/react-table v9: features are explicit and tree-shaken, unlike
// v8's implicit getXRowModel() imports. This is the one place the table
// feature set is assembled, so every table in the app stays consistent.
export const tableFeaturesConfig = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
  },
});

export function createTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<typeof tableFeaturesConfig, TData>();
}
