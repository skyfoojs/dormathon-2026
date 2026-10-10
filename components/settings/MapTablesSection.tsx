"use client";

import * as React from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Select, Label } from "@/components/ui/Input";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { TABLE_MAP_ROWS, type TableMapRow } from "@/lib/mock/settingsMock";

const STATUS_TONE: Record<TableMapRow["status"], TagTone> = {
  Matched: "green",
  Remapped: "blue",
  "Not mapped": "amber",
};

export function MapTablesSection() {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <CardTitle>Map tables</CardTitle>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-page">
              {["AiGIS table", "Source table", "Row count", "Used for", "Status"].map((h) => (
                <th key={h} scope="col" className="px-3 py-2.5 text-left font-mono text-xs font-medium tracking-wide text-muted uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TABLE_MAP_ROWS.map((row) => (
              <MapRow key={row.table} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MapRow({ row }: { row: TableMapRow }) {
  const [source, setSource] = React.useState(row.status === "Not mapped" ? "" : row.table);
  const id = `map-${row.table}`;

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-3 py-2.5 font-mono">{row.table}</td>
      <td className="px-3 py-2.5">
        <Label htmlFor={id} className="sr-only">
          Source table for {row.table}
        </Label>
        <Select id={id} value={source} onChange={(e) => setSource(e.target.value)} className="w-48">
          <option value="">Not mapped</option>
          <option value={row.table}>{row.table}</option>
          <option value={`legacy_${row.table}`}>{`legacy_${row.table}`}</option>
        </Select>
      </td>
      <td className="px-3 py-2.5 font-mono">{row.rowCount}</td>
      <td className="px-3 py-2.5 text-muted">{row.purpose}</td>
      <td className="px-3 py-2.5">
        <Tag tone={STATUS_TONE[row.status]}>{row.status}</Tag>
      </td>
    </tr>
  );
}
