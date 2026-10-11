export type DbType = "PostgreSQL" | "MySQL" | "SQL Server" | "SQLite" | "CSV or SQL file upload";

export const DB_TYPES: { type: DbType; defaultPort: string | null }[] = [
  { type: "PostgreSQL", defaultPort: "5432" },
  { type: "MySQL", defaultPort: "3306" },
  { type: "SQL Server", defaultPort: "1433" },
  { type: "SQLite", defaultPort: null },
  { type: "CSV or SQL file upload", defaultPort: null },
];

export type TableMapRow = {
  table: string;
  purpose: string;
  rowCount: number;
  status: "Matched" | "Remapped" | "Not mapped";
};

// Synthetic data: illustrative mapping state for the mockup.
export const TABLE_MAP_ROWS: TableMapRow[] = [
  { table: "facilities", purpose: "Hospitals and clinics this system covers", rowCount: 4, status: "Matched" },
  { table: "suppliers", purpose: "Who items are ordered from", rowCount: 3, status: "Matched" },
  { table: "items", purpose: "Catalogue of tracked stock items", rowCount: 6, status: "Matched" },
  { table: "tracker_readings", purpose: "Haze readings (US AQI) over time", rowCount: 56, status: "Matched" },
  { table: "weekly_inventory", purpose: "Weekly stock movement per facility and item", rowCount: 96, status: "Matched" },
  { table: "purchase_orders", purpose: "Orders placed with suppliers", rowCount: 8, status: "Remapped" },
  { table: "batches", purpose: "Lot numbers and expiry per item", rowCount: 3, status: "Not mapped" },
];

export type MigrationStep = { label: string; result: string };

export const DRY_RUN_STEPS: MigrationStep[] = [
  { label: "Read schema", result: "7 tables found, column names compared against AiGIS schema." },
  { label: "Check keys", result: "Primary and foreign keys resolved for 6 of 7 tables." },
  { label: "Check dates", result: "Date columns parse cleanly; no format mismatches found." },
  { label: "Find gaps", result: "batches has no source-table mapping yet." },
  { label: "Report", result: "Dry run complete. 1 table needs mapping before a real migration." },
];

export type MigrationHistoryEntry = { label: string; timeLabel: string; status: "Dry run" | "Completed" };

export const MIGRATION_HISTORY: MigrationHistoryEntry[] = [
  { label: "Dry run against sample CSV export", timeLabel: "Yesterday, 14:02", status: "Dry run" },
  { label: "Initial schema mapping", timeLabel: "3 days ago", status: "Completed" },
];
