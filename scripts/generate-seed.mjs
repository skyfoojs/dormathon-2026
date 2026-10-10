// Writes seed.sql: a reset of the stock, order and forecast data with a
// realistic history for the existing items.
//
//   node scripts/generate-seed.mjs [last-day]     (default 2026-10-10)
//
// The same last day always gives the same file. Each item is simulated day
// by day: demand follows a weekday pattern and rises with haze, and stock is
// reordered from the item's supplier when it falls to a reorder point.

import { writeFileSync } from "node:fs";

const END_DATE = process.argv[2] ?? "2026-10-10";
const HISTORY_DAYS = 181;
const FACILITY_ID = 7;
const FIRST_PO_ID = 3001;
const FIRST_BATCH_ID = 401;
const FIRST_WEEKLY_RECORD_ID = 6001;
const MS_PER_DAY = 86_400_000;

const FACILITY = {
  facility_id: FACILITY_ID,
  facility_name: "Sunway Medical Centre",
  facility_type: "Hospital",
  sector: "Private",
  district: "Petaling",
  state: "Selangor",
  size_tier: "Medium",
};

const SUPPLIERS = [
  { supplier_id: 1, supplier_name: "Meridian Pharma Distribution Sdn Bhd", supplier_type: "Pharma Distributor", state: "Selangor", lead_time_days: 4, reliability_score: 0.97 },
  { supplier_id: 2, supplier_name: "Nusantara Medicines Supply Sdn Bhd", supplier_type: "Pharma Distributor", state: "W.P. Kuala Lumpur", lead_time_days: 6, reliability_score: 0.94 },
  { supplier_id: 3, supplier_name: "Harbour Lifescience Trading Sdn Bhd", supplier_type: "Pharma Distributor", state: "Selangor", lead_time_days: 9, reliability_score: 0.91 },
  { supplier_id: 4, supplier_name: "Klang Valley MedConsumables Sdn Bhd", supplier_type: "Consumables & PPE", state: "Selangor", lead_time_days: 5, reliability_score: 0.95 },
  { supplier_id: 5, supplier_name: "Prima Protective Supplies Sdn Bhd", supplier_type: "Consumables & PPE", state: "Johor", lead_time_days: 10, reliability_score: 0.88 },
  { supplier_id: 6, supplier_name: "Oxy-Gas Industrial Medical Sdn Bhd", supplier_type: "Medical Gas", state: "Selangor", lead_time_days: 3, reliability_score: 0.98 },
  { supplier_id: 7, supplier_name: "DiagnoLink Sdn Bhd", supplier_type: "Diagnostics", state: "W.P. Kuala Lumpur", lead_time_days: 7, reliability_score: 0.93 },
  { supplier_id: 8, supplier_name: "BioEquip Malaysia Sdn Bhd", supplier_type: "Equipment", state: "Pulau Pinang", lead_time_days: 14, reliability_score: 0.9 },
];

// Outpatient items are busier on weekdays; inpatient and emergency items
// are used at much the same rate every day. Monday first.
const OUTPATIENT_WEEK = [1.12, 1.08, 1.05, 1.03, 1.02, 0.88, 0.82];
const INPATIENT_WEEK = [1.03, 1.02, 1.0, 1.0, 1.0, 0.98, 0.97];

// How each item ends the history:
//   stocked   comfortably above its reorder point, nothing on order
//   low       reordering was missed, so AiGIS has an order to raise
//   incoming  an order is in transit and due after the last day
//   late      an order is in transit and already past its expected date
//
// dailyUse is usage on an ordinary day; haze is how strongly usage rises
// with the air pollution index; pack is the supplier's order multiple.
const ITEMS = [
  { item_id: 1, item_name: "Salbutamol 100mcg MDI inhaler", category: "Medication", unit: "inhaler", unit_cost_myr: 8.5, shelf_life_months: 24, is_critical: 1, storage: "Ambient", primary_supplier_id: 2, dailyUse: 5, haze: 0.6, pack: 10, week: OUTPATIENT_WEEK, ends: "low" },
  { item_id: 2, item_name: "Salbutamol 2.5mg nebule", category: "Medication", unit: "nebule", unit_cost_myr: 0.9, shelf_life_months: 24, is_critical: 1, storage: "Ambient", primary_supplier_id: 3, dailyUse: 28, haze: 0.6, pack: 50, week: INPATIENT_WEEK, ends: "incoming" },
  { item_id: 3, item_name: "Ipratropium 0.5mg nebule", category: "Medication", unit: "nebule", unit_cost_myr: 1.1, shelf_life_months: 24, is_critical: 1, storage: "Ambient", primary_supplier_id: 1, dailyUse: 20, haze: 0.5, pack: 50, week: INPATIENT_WEEK, ends: "stocked" },
  { item_id: 4, item_name: "Budesonide 200mcg inhaler", category: "Medication", unit: "inhaler", unit_cost_myr: 28, shelf_life_months: 24, is_critical: 0, storage: "Ambient", primary_supplier_id: 2, dailyUse: 3, haze: 0.3, pack: 10, week: OUTPATIENT_WEEK, ends: "stocked" },
  { item_id: 5, item_name: "Prednisolone 5mg tablet", category: "Medication", unit: "tablet", unit_cost_myr: 0.05, shelf_life_months: 36, is_critical: 0, storage: "Ambient", primary_supplier_id: 3, dailyUse: 190, haze: 0.25, pack: 500, week: OUTPATIENT_WEEK, ends: "stocked" },
  { item_id: 6, item_name: "Hydrocortisone 100mg injection", category: "Medication", unit: "vial", unit_cost_myr: 3.5, shelf_life_months: 24, is_critical: 1, storage: "Ambient", primary_supplier_id: 1, dailyUse: 9, haze: 0.2, pack: 10, week: INPATIENT_WEEK, ends: "stocked" },
  { item_id: 7, item_name: "Oxygen cylinder (E-size) refill", category: "Medical Gas", unit: "cylinder", unit_cost_myr: 25, shelf_life_months: null, is_critical: 1, storage: "Gas store", primary_supplier_id: 6, dailyUse: 6, haze: 0.3, pack: 10, week: INPATIENT_WEEK, ends: "late" },
  { item_id: 8, item_name: "Nasal cannula", category: "Consumable", unit: "piece", unit_cost_myr: 1.2, shelf_life_months: 60, is_critical: 0, storage: "Ambient", primary_supplier_id: 4, dailyUse: 24, haze: 0.3, pack: 50, week: INPATIENT_WEEK, ends: "stocked" },
  { item_id: 9, item_name: "N95 respirator mask", category: "PPE", unit: "piece", unit_cost_myr: 2.8, shelf_life_months: 36, is_critical: 1, storage: "Ambient", primary_supplier_id: 5, dailyUse: 110, haze: 0.7, pack: 100, week: OUTPATIENT_WEEK, ends: "low" },
  { item_id: 11, item_name: "Nebulizer mask set", category: "Consumable", unit: "set", unit_cost_myr: 2.5, shelf_life_months: 60, is_critical: 0, storage: "Ambient", primary_supplier_id: 5, dailyUse: 13, haze: 0.5, pack: 20, week: INPATIENT_WEEK, ends: "low" },
];

// Weekly average air pollution index, oldest first. The haze season builds
// from August and peaks in mid September.
const HAZE_BY_WEEK = [33, 36, 39, 42, 43, 19, 42, 21, 34, 33, 39, 65, 58, 65, 39, 92, 87, 92, 83, 86, 160, 109, 105, 82, 94, 78];

const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY);
const isoDate = (day) => new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
// Day 0 (1 Jan 1970) was a Thursday, so (day + 3) % 7 is days since Monday.
const weekdayOf = (day) => (day + 3) % 7;

const endDay = dayNumber(END_DATE);
const firstDay = endDay - (HISTORY_DAYS - 1) - weekdayOf(endDay - (HISTORY_DAYS - 1));

function hazeOn(day) {
  const week = Math.floor((day - firstDay) / 7);
  return HAZE_BY_WEEK[Math.min(Math.max(week, 0), HAZE_BY_WEEK.length - 1)];
}

function hazeCategory(api) {
  if (api <= 50) return "Good";
  if (api <= 100) return "Moderate";
  return "Unhealthy";
}

// Small seeded generator, so a run can be repeated exactly.
function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, normal, int: (min, max) => min + Math.floor(next() * (max - min + 1)) };
}

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const stdDev = (values) => Math.sqrt(mean(values.map((v) => (v - mean(values)) ** 2)));
const roundUpTo = (value, step) => Math.max(step, Math.ceil(value / step) * step);

function expectedUse(item, day) {
  const hazeLift = 1 + item.haze * Math.min(Math.max((hazeOn(day) - 50) / 100, 0), 1.2);
  return item.dailyUse * item.week[weekdayOf(day)] * hazeLift;
}

// Counts scatter around the expected figure: small counts by about their
// square root, large ones by a little more.
function drawDemand(random, expected) {
  const spread = Math.sqrt(expected * (1 + expected * 0.02));
  return Math.max(0, Math.round(expected + spread * random.normal()));
}

// How long before the last day reordering stops for an item that ends low.
function freezeDays(item, leadDays) {
  return item.ends === "low" ? leadDays + 9 : 0;
}

function simulate(item, seed) {
  const random = createRandom(seed);
  const supplier = SUPPLIERS.find((s) => s.supplier_id === item.primary_supplier_id);
  const leadDays = supplier.lead_time_days;
  const z = item.is_critical ? 2.05 : 1.65;
  const lastOrderDay = endDay - freezeDays(item, leadDays);

  const days = [];
  const orders = [];
  const recentUse = [];
  let openOrder = null;
  let stock = Math.round(item.dailyUse * (leadDays + 8 + random.next() * 20));
  let reorderPoint = 0;

  for (let day = firstDay; day <= endDay; day++) {
    const opening = stock;
    let received = 0;
    if (openOrder && openOrder.arrivalDay === day) {
      received = openOrder.qtyReceived;
      openOrder.delivered = true;
      openOrder = null;
    }

    const demand = drawDemand(random, expectedUse(item, day));
    const issued = Math.min(demand, opening + received);
    // Now and then a little stock is written off as damaged or expired.
    const wastage = item.shelf_life_months !== null && random.next() < 0.012 ? Math.min(opening + received - issued, random.int(1, Math.max(1, Math.round(item.dailyUse * 0.3)))) : 0;
    stock = opening + received - issued - wastage;
    days.push({ day, opening, received, issued, unmet: demand - issued, wastage, closing: stock });

    recentUse.push(demand);
    if (recentUse.length > 28) recentUse.shift();
    const usual = mean(recentUse);
    reorderPoint = usual * (leadDays + 2) + z * stdDev(recentUse) * Math.sqrt(leadDays);

    const isWorkingDay = weekdayOf(day) < 5;
    if (!openOrder && isWorkingDay && day <= lastOrderDay && recentUse.length >= 7 && stock <= reorderPoint) {
      const qtyOrdered = roundUpTo(usual * 28, item.pack);
      const isLate = random.next() < (1 - supplier.reliability_score) * 2;
      let arrivalDay = day + leadDays + (isLate ? random.int(1, 3) : 0);
      // The late item's last order is the one still stuck on the road.
      if (item.ends === "late" && day + leadDays >= endDay - 3 && day + leadDays <= endDay - 1) arrivalDay = endDay + 3;
      const isShort = random.next() < 0.08;
      openOrder = {
        orderDay: day,
        expectedDay: day + leadDays,
        arrivalDay,
        qtyOrdered,
        qtyReceived: isShort ? qtyOrdered - Math.max(1, Math.round(qtyOrdered * (0.02 + random.next() * 0.04))) : qtyOrdered,
        delivered: false,
      };
      orders.push(openOrder);
    }
  }

  return { item, supplier, days, orders, reorderPoint, openOrder, usual: mean(recentUse) };
}

// Whether a simulated history ends the way the item is meant to.
function endsAsPlanned(run) {
  const { item, days, openOrder, reorderPoint, usual } = run;
  const stock = days[days.length - 1].closing;
  const emptyDays = days.filter((d) => d.closing === 0).length;
  if (item.ends === "low") return !openOrder && stock >= usual * 2 && stock <= usual * 5 && emptyDays === 0;
  if (emptyDays > 0) return false;
  if (item.ends === "stocked") return !openOrder && stock >= reorderPoint + usual * 6;
  if (item.ends === "incoming") return openOrder !== null && openOrder.arrivalDay >= endDay + 2 && openOrder.expectedDay >= endDay + 1;
  return openOrder !== null && openOrder.expectedDay < endDay && stock >= usual * 2;
}

function simulateAsPlanned(item) {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const run = simulate(item, item.item_id * 100_003 + attempt);
    if (endsAsPlanned(run)) return run;
  }
  throw new Error(`No history for ${item.item_name} ends "${item.ends}". Loosen endsAsPlanned.`);
}

const addMonths = (iso, months) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
};

// The stock on the shelf, split into the lots it arrived in, newest first.
function toBatches(run, random) {
  const batches = [];
  let remaining = run.days[run.days.length - 1].closing;
  for (const order of [...run.orders].reverse()) {
    if (remaining <= 0) break;
    if (!order.delivered) continue;
    const quantity = Math.min(remaining, order.qtyReceived);
    const receivedDate = isoDate(order.arrivalDay);
    const shelfLife = run.item.shelf_life_months;
    batches.push({
      item_id: run.item.item_id,
      lot_no: `LOT${random.int(100000, 999999)}`,
      quantity,
      received_date: receivedDate,
      // Stock has already spent a few months with the supplier.
      expiry_date: shelfLife === null ? null : addMonths(receivedDate, shelfLife - random.int(2, 7)),
    });
    remaining -= quantity;
  }
  return batches;
}

function toWeeklyRows(run) {
  const rows = [];
  const recentIssues = [];
  for (let start = 0; start + 7 <= run.days.length; start += 7) {
    const week = run.days.slice(start, start + 7);
    const issued = week.reduce((sum, d) => sum + d.issued, 0);
    recentIssues.push(issued);
    if (recentIssues.length > 6) recentIssues.shift();
    const closing = week[6].closing;
    rows.push({
      item_id: run.item.item_id,
      week_start: isoDate(week[0].day),
      opening_stock: week[0].opening,
      received_qty: week.reduce((sum, d) => sum + d.received, 0),
      issued_qty: issued,
      unmet_demand_qty: week.reduce((sum, d) => sum + d.unmet, 0),
      wastage_qty: week.reduce((sum, d) => sum + d.wastage, 0),
      closing_stock: closing,
      weeks_of_cover: mean(recentIssues) > 0 ? Math.round((closing / mean(recentIssues)) * 100) / 100 : 0,
      stockout_flag: week.some((d) => d.closing === 0) ? 1 : 0,
      haze_api_avg: hazeOn(week[0].day),
    });
  }
  return rows;
}

// ---------------------------------------------------------------- SQL

function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insert(table, columns, rows, chunkSize = 250) {
  const statements = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const values = rows.slice(i, i + chunkSize).map((row) => `  (${columns.map((c) => literal(row[c])).join(", ")})`);
    statements.push(`INSERT INTO public.${table} (${columns.join(", ")}) VALUES\n${values.join(",\n")}`);
  }
  return statements;
}

function upsert(table, key, columns, rows, updateOverrides = {}) {
  const updates = columns.filter((c) => c !== key).map((c) => `${c} = ${updateOverrides[c] ?? `EXCLUDED.${c}`}`);
  return insert(table, columns, rows).map((s) => `${s}\nON CONFLICT (${key}) DO UPDATE SET ${updates.join(", ")}`);
}

const runs = ITEMS.map(simulateAsPlanned);
const lotRandom = createRandom(endDay);

const dailyRows = runs.flatMap((run) => {
  // The original dataset's fixed threshold. The app reads items.reorder_level instead.
  const fixedLevel = Math.round(run.item.dailyUse * (run.supplier.lead_time_days + 4));
  return run.days.map((d) => ({
    facility_id: FACILITY_ID,
    item_id: run.item.item_id,
    inventory_date: isoDate(d.day),
    opening_stock: d.opening,
    received_qty: d.received,
    issued_qty: d.issued,
    unmet_demand_qty: d.unmet,
    wastage_qty: d.wastage,
    closing_stock: d.closing,
    reorder_level: fixedLevel,
    stockout_flag: d.closing === 0 ? 1 : 0,
  }));
});

let recordId = FIRST_WEEKLY_RECORD_ID;
const weeklyRows = runs.flatMap((run) => {
  const fixedLevel = Math.round(run.item.dailyUse * (run.supplier.lead_time_days + 4));
  return toWeeklyRows(run).map((row) => ({ record_id: recordId++, facility_id: FACILITY_ID, ...row, reorder_level: fixedLevel }));
});

const orderRows = runs
  .flatMap((run) => run.orders.map((order) => ({ run, order })))
  .sort((a, b) => a.order.orderDay - b.order.orderDay || a.run.item.item_id - b.run.item.item_id)
  .map(({ run, order }, i) => ({
    po_id: FIRST_PO_ID + i,
    facility_id: FACILITY_ID,
    item_id: run.item.item_id,
    supplier_id: run.supplier.supplier_id,
    order_date: isoDate(order.orderDay),
    qty_ordered: order.qtyOrdered,
    unit_cost_myr: run.item.unit_cost_myr,
    expected_receipt_date: isoDate(order.expectedDay),
    actual_receipt_date: order.delivered ? isoDate(order.arrivalDay) : null,
    qty_received: order.delivered ? order.qtyReceived : null,
    status: order.delivered ? "Delivered" : "In transit",
    created_by: "Manual",
  }));

const batchRows = runs.flatMap((run) => toBatches(run, lotRandom)).map((batch, i) => ({ batch_id: FIRST_BATCH_ID + i, facility_id: FACILITY_ID, ...batch }));

const hazeRows = [];
for (let day = firstDay; day <= endDay; day += 7) {
  hazeRows.push({ facility_id: FACILITY_ID, week_start: isoDate(day), api_avg: hazeOn(day), api_category: hazeCategory(hazeOn(day)) });
}

const itemRows = ITEMS.map((item) => ({ ...item, cover_days: null, reorder_level: 0 }));
const supplierRows = SUPPLIERS.map((supplier) => ({ ...supplier, country: "Malaysia" }));

const statements = [
  // Forecasts, AiGIS orders and the AI run history were worked out from the
  // old stock figures, so they all go. News sources are kept.
  "TRUNCATE TABLE public.ai_forecasts, public.demand_forecasts, public.news_verdicts, public.articles, public.llm_calls, public.council_seats, public.council_runs, public.sync_runs, public.purchase_orders, public.po_documents, public.batches, public.daily_inventory, public.weekly_inventory, public.haze_api_weekly RESTART IDENTITY",
  ...upsert("facilities", "facility_id", ["facility_id", "facility_name", "facility_type", "sector", "district", "state", "size_tier"], [FACILITY]),
  // suppliers.email is left as it is: it holds a real address.
  ...upsert("suppliers", "supplier_id", ["supplier_id", "supplier_name", "supplier_type", "state", "lead_time_days", "reliability_score", "country"], supplierRows),
  ...upsert("items", "item_id", ["item_id", "item_name", "category", "unit", "unit_cost_myr", "shelf_life_months", "is_critical", "storage", "primary_supplier_id", "cover_days", "reorder_level"], itemRows, {
    reorder_level: "COALESCE(items.reorder_level, EXCLUDED.reorder_level)",
  }),
  ...insert("haze_api_weekly", ["facility_id", "week_start", "api_avg", "api_category"], hazeRows),
  ...insert("daily_inventory", ["facility_id", "item_id", "inventory_date", "opening_stock", "received_qty", "issued_qty", "unmet_demand_qty", "wastage_qty", "closing_stock", "reorder_level", "stockout_flag"], dailyRows),
  ...insert("weekly_inventory", ["record_id", "facility_id", "item_id", "week_start", "opening_stock", "received_qty", "issued_qty", "unmet_demand_qty", "wastage_qty", "closing_stock", "reorder_level", "weeks_of_cover", "stockout_flag", "haze_api_avg"], weeklyRows),
  ...insert("purchase_orders", ["po_id", "facility_id", "item_id", "supplier_id", "order_date", "qty_ordered", "unit_cost_myr", "expected_receipt_date", "actual_receipt_date", "qty_received", "status", "created_by"], orderRows),
  ...insert("batches", ["batch_id", "facility_id", "item_id", "lot_no", "quantity", "received_date", "expiry_date"], batchRows),
];

const header = `-- AiGIS seed data. Generated by scripts/generate-seed.mjs: edit that, not this file.
--
-- Resets stock, orders and forecasts to a realistic history for the existing
-- items, from ${isoDate(firstDay)} to ${END_DATE}. Running it again gives the same data.
--
-- REMOVES every row from: ai_forecasts, demand_forecasts, news_verdicts,
-- articles, llm_calls, council_seats, council_runs, sync_runs, purchase_orders,
-- po_documents, batches, daily_inventory, weekly_inventory, haze_api_weekly.
-- KEEPS: news sources, policies, and suppliers.email.
--
-- After running it, press Full sync on the Predictions page for fresh forecasts.
`;

writeFileSync("seed.sql", `${header}\nBEGIN;\n\n${statements.join(";\n\n")};\n\nCOMMIT;\n`);

console.log(`seed.sql: ${dailyRows.length} daily rows, ${weeklyRows.length} weekly rows, ${orderRows.length} orders, ${batchRows.length} batches`);
for (const run of runs) {
  const last = run.days[run.days.length - 1];
  const open = run.openOrder ? `open order due ${isoDate(run.openOrder.expectedDay)}` : "nothing on order";
  console.log(`  ${String(run.item.item_id).padStart(2)} ${run.item.item_name.padEnd(32)} ${run.item.ends.padEnd(8)} stock ${String(last.closing).padStart(5)}  ${open}`);
}
