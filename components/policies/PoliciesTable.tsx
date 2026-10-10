"use client";

import { DataTable } from "@/components/ui/DataTable";
import { RowActions } from "@/components/items/RowActions";
import { createTableColumnHelper } from "@/lib/table/features";
import { formatDateTime } from "@/lib/data/dates";
import type { Policy } from "@/lib/db/types";

const POLICIES_PER_PAGE = 10;

const helper = createTableColumnHelper<Policy>();

export function PoliciesTable({
  policies,
  onEdit,
  onDelete,
}: {
  policies: Policy[];
  onEdit: (policy: Policy) => void;
  onDelete: (policy: Policy) => void;
}) {
  const columns = [
    helper.accessor((p) => p.description, {
      id: "description",
      header: "Description",
      cell: ({ getValue }) => <p className="max-w-prose min-w-64 whitespace-pre-wrap">{getValue()}</p>,
    }),
    helper.accessor((p) => p.created_at, {
      id: "createdAt",
      header: "Created",
      cell: ({ getValue }) => <span className="font-mono whitespace-nowrap">{formatDateTime(getValue())}</span>,
    }),
    helper.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <RowActions
          label={`policy ${row.original.policy_id}`}
          onEdit={() => onEdit(row.original)}
          onDelete={() => onDelete(row.original)}
        />
      ),
    }),
  ];

  return (
    <DataTable
      columns={columns}
      data={policies}
      getRowId={(p) => String(p.policy_id)}
      emptyMessage="No policies yet. Add the first one."
      pageSize={POLICIES_PER_PAGE}
    />
  );
}
