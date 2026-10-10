"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { DayStatusLegend, MonthCalendar, type DayStatus } from "@/components/ui/MonthCalendar";
import { FilterChips } from "@/components/ui/FilterChips";
import { SearchInput } from "@/components/ui/SearchInput";
import { StatTile } from "@/components/ui/StatTile";
import { DailyStockTable } from "@/components/inventory/DailyStockTable";
import * as api from "@/lib/api/resources";
import type { DailyStockInput } from "@/lib/api/resources";
import { ErrorBanner } from "@/components/ui/Banner";

type EntryFilter = "all" | "missing" | "entered";

export default function InventoryView() {
  const qc = useQueryClient();
  const [today] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  const [date, setDate] = React.useState(today);
  const [month, setMonth] = React.useState(today);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<EntryFilter>("all");
  const monthKey = month.slice(0, 7);

  const stockQuery = useQuery({ queryKey: ["daily-stock", date], queryFn: () => api.getDailyStock(date) });
  const dayCountsQuery = useQuery({
    queryKey: ["daily-stock-days", monthKey],
    queryFn: () => api.getDailyStockDayCounts(monthKey),
  });
  const itemsQuery = useQuery({ queryKey: ["items"], queryFn: api.getItems });

  const saveMutation = useMutation({
    mutationFn: (input: DailyStockInput) => api.saveDailyStock(input),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["daily-stock"] }),
        qc.invalidateQueries({ queryKey: ["daily-stock-days"] }),
      ]),
  });

  const rows = stockQuery.data ?? [];
  const itemCount = itemsQuery.data?.length ?? 0;
  const dayCounts = React.useMemo(
    () => new Map((dayCountsQuery.data ?? []).map((d) => [d.date, d.entered])),
    [dayCountsQuery.data],
  );

  function getStatus(day: string): DayStatus | null {
    if (itemCount === 0) return null;
    const entered = dayCounts.get(day) ?? 0;
    if (entered >= itemCount) return "complete";
    return entered > 0 ? "partial" : "missing";
  }

  function selectDate(day: string) {
    setDate(day);
    setMonth(day);
  }

  const enteredCount = rows.filter((r) => r.entered).length;
  const stockoutCount = rows.filter((r) => r.stockout).length;
  const visibleRows = rows.filter(
    (r) =>
      r.item_name.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "all" || (filter === "entered") === r.entered),
  );
  const loadError = stockQuery.error || dayCountsQuery.error || itemsQuery.error;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Record each item's stock movements for the day. Opening and closing stock are calculated."
      />

      {loadError ? (
        <ErrorBanner>
          Could not load data from the database: {(loadError as Error).message}
        </ErrorBanner>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card as="section" aria-label="Choose a day" className="flex flex-col gap-3 p-5">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            selected={date}
            onSelect={selectDate}
            maxDate={today}
            getStatus={getStatus}
          />
          <DayStatusLegend />
        </Card>

        <Card as="section" className="flex flex-col gap-4 p-5 lg:col-span-2">
          <CardHeader>
            <CardTitle>{format(parseISO(date), "EEEE d MMMM yyyy")}</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Items entered" value={`${enteredCount} of ${rows.length}`} />
              <StatTile label="Still missing" value={rows.length - enteredCount} />
              <StatTile label="Stockouts" value={stockoutCount} />
            </div>
            <p className="text-sm text-strong-muted">
              Opening stock is the previous day&apos;s closing stock. Closing = opening + received − issued −
              wastage. Editing a past day carries the change forward to later days.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card as="section" aria-label="Stock for the day" className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SearchInput
            id="daily-stock-search"
            label="Search items"
            placeholder="Search items by name"
            value={search}
            onChange={setSearch}
          />
          <FilterChips
            label="Entry status"
            value={filter}
            onChange={setFilter}
            chips={[
              { id: "all", label: "All", count: rows.length },
              { id: "missing", label: "Missing", count: rows.length - enteredCount },
              { id: "entered", label: "Entered", count: enteredCount },
            ]}
          />
        </div>
        {stockQuery.isLoading ? (
          <p role="status" className="text-sm text-muted">
            Loading stock{"…"}
          </p>
        ) : (
          <DailyStockTable key={date} rows={visibleRows} onSave={saveMutation.mutateAsync} />
        )}
      </Card>
    </>
  );
}
