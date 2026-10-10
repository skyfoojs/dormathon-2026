# AiGIS Specifications

How AiGIS forecasts demand, adjusts the forecast with AI, raises purchase orders, and scores its own accuracy.

This document describes the code as it stands on `main` (October 2026). It was compiled by reading the source, not by running it. Where the code and its comments disagree, the code is described and the difference is listed under [Known gaps](#8-known-gaps).

## Contents

1. [Business process](#1-business-process)
2. [Data model](#2-data-model)
3. [Arithmetic forecast](#3-arithmetic-forecast)
4. [AI adjustment](#4-ai-adjustment)
5. [Purchase orders](#5-purchase-orders)
6. [Accuracy](#6-accuracy)
7. [End-to-end flow](#7-end-to-end-flow)
8. [Known gaps](#8-known-gaps)
9. [API reference](#9-api-reference)

---

## 1. Business process

AiGIS is a hospital inventory tool for a single facility.

1. **Stock is recorded daily.** Each item has one row per day: quantity issued, unmet demand, and closing stock.
2. **An arithmetic forecast runs** over that history. It predicts daily usage per item, a safety stock, a reorder point, and the dates stock will reach the reorder point and run out.
3. **News is read.** WHO Disease Outbreak News is fetched and an LLM screens each article for relevance to medical supply or demand.
4. **An AI council validates the news:** is it credible, how severe is it, and which item categories does it touch.
5. **A second AI council adjusts the forecast.** It returns only a multiplier on the arithmetic usage curve (1.3 means 30% more) and how long the effect lasts. Code turns that into quantities and dates.
6. **Purchase orders are raised.** An item whose projected stock reaches its reorder trigger within the supplier lead time gets a `Pending` order created by AiGIS. Lines for the same supplier share one order.
7. **Staff manage orders** on the Orders page: edit, mark delivered, delete.
8. **Accuracy is scored weekly** by comparing predicted usage with recorded usage, and shown on the dashboard.

---

## 2. Data model

Defined in `schema.sql`. The tables this document relies on:

| Table | Purpose |
| --- | --- |
| `items` | Catalogue. Carries `is_critical`, `cover_days`, `reorder_level`, `primary_supplier_id`, `unit_cost_myr`. |
| `suppliers` | Carries `lead_time_days`. |
| `daily_inventory` | One row per item per day: `issued_qty`, `unmet_demand_qty`, `closing_stock`. Source for demand and stock on hand. |
| `purchase_orders` | One row per order line. `status` is `Pending`, `In transit`, `Delivered` or `Cancelled`. `created_by` is `AiGIS` for automated orders. |
| `po_documents` | Ties the lines of a multi-line order together. |
| `demand_forecasts` | One saved arithmetic forecast per item per run. |
| `ai_forecasts` | One AI adjustment per item per sync run, pointing at the `demand_forecasts` row it scales. |
| `sync_runs` | One row per pipeline run: trigger, scope, status, stage. A unique index allows only one queued or running run. |
| `news_sources`, `articles` | News feeds and fetched articles, with screening result. |
| `council_runs`, `council_seats`, `news_verdicts` | Council bookkeeping and cycle 1 output. |
| `llm_calls` | Every LLM call with tokens, cost, output and error. |

The `facilities` table and `facility_id` columns are due to be dropped. Forecast code does not filter on them.

---

## 3. Arithmetic forecast

Math: `lib/forecast/demand.ts`. Orchestration: `lib/forecast/run.ts`. Stock projection: `lib/forecast/runout.ts`.

### 3.1 When it runs

| Trigger | Effect |
| --- | --- |
| `POST /api/forecasts` | Runs and saves. |
| Sync run with scope `full` | Runs and saves as the first pipeline stage. The scheduled `daily` trigger uses `full`. |
| `GET /api/forecasts` | Computes live for every item. Saves nothing. |
| Automated purchase orders | Computes live inside the restock plan. Saves nothing. |

### 3.2 Constants

| Constant | Value | Meaning |
| --- | --- | --- |
| `DEFAULT_ALPHA` | 0.4 | Holt level smoothing when not tuned |
| `DEFAULT_BETA` | 0.05 | Holt trend smoothing when not tuned |
| `TREND_DAMPING` (φ) | 0.95 | Trend damping factor |
| `WMA_DAYS` | 28 | Moving average window |
| `MIN_DAYS_FOR_METHODS` | 28 | History needed to use Holt and WMA |
| `MIN_DAYS_FOR_TUNING` | 84 | History needed to tune α and β |
| `MIN_ERRORS_FOR_SCORING` | 56 | Scored days needed to weight the blend and use forecast errors for sigma |
| `MIN_WEIGHT`, `MAX_WEIGHT` | 0.25, 0.75 | Clamp on the Holt weight |
| `MAX_INTERPOLATED_GAP_DAYS` | 14 | Longest gap filled by interpolation |
| `Z_CRITICAL`, `Z_STANDARD` | 2.05, 1.65 | Service level factor (98%, 95%) |
| `DEFAULT_COVER_DAYS` | 30 | Days of usage one buy should cover |
| `FALLBACK_LEAD_DAYS` | 7 | Lead time when nothing else is known |

### 3.3 Calculation per item

Implemented by `forecastItem`.

1. **Demand series.** Demand per day = `issued_qty + unmet_demand_qty`, oldest first. A gap of up to 14 days is filled by linear interpolation. A longer gap discards everything before it.
2. **Short history (under 28 days).** Usage per day = mean of demand. Sigma = sample standard deviation of demand. Steps 3 to 8 are skipped.
3. **Method A: damped Holt linear trend.**
   - `level = α·y + (1 − α)·(level + φ·trend)`
   - `trend = β·(level − prevLevel) + (1 − β)·φ·trend`
   - One-day-ahead forecast = `max(level + φ·trend, 0)`
   - With 84 or more days, α (0.1 to 0.9) and β (0.01 to 0.10) are chosen by grid search for the lowest one-day-ahead mean absolute error. Otherwise the defaults apply.
4. **Method B: 28-day weighted moving average.** The newest day has weight 28 and the oldest weight 1.
5. **Backtest.** From day 28 onward, each day is forecast by Holt, by WMA, and by a naive "same as yesterday". Each gets a mean absolute error (MAE).
6. **Blend weight.** With 56 or more scored days, Holt weight `w = wmaMae / (holtMae + wmaMae)`, clamped to 0.25 to 0.75. Otherwise `w = 0.5`.
7. **Usage on day h** (h = 1 is the day after the last recorded day):
   - `holtPart = max(level + trend · φ(1 − φ^h) / (1 − φ), 0)`
   - `usage(h) = max(w · holtPart + (1 − w) · WMA, 0)`
   - `usagePerDay` is `usage(1)`.
8. **Sigma.** With 56 or more scored days, the sample standard deviation of the blended backtest errors. Otherwise the standard deviation of demand.
9. **Lead time.** Mean days from `order_date` to `actual_receipt_date` over the item's delivered orders. If none, the supplier's `lead_time_days`. If none, 7.
10. **Safety stock** = `z · sigma · √leadDays`, with z = 2.05 for critical items and 1.65 otherwise.
11. **Reorder point** = sum of `usage(h)` over the lead time + safety stock.
12. **Buy quantity** = sum of `usage(h)` over `cover_days` + safety stock.

Fractional day counts are handled by adding the fraction of the next day's usage.

### 3.4 Stock run-down projection

Implemented by `projectStock`.

- Starts from the last recorded closing stock.
- Each day: `stock = max(0, stock + arrivals − usage(day))`.
- Arrivals are `In transit` orders on their `expected_receipt_date`. An order already past its expected date lands on the first projected day.
- Runs up to 84 days, stopping early once stock is zero and no arrival is still due.
- **Threshold** = the item's `reorder_level` if set, otherwise the reorder point.
- Records the **trigger date** (first day stock ≤ threshold) and the **stockout date** (first day stock = 0). If the last recorded stock is already at or below the threshold, the trigger is marked as already reached.

### 3.5 Saving

Implemented by `runForecasts`.

1. Fill `actual_qty` on saved forecasts whose forecast day now has demand data. This runs first so a forecast is never scored by its own run.
2. Compute the forecast and projection for every item.
3. Insert one `demand_forecasts` row per item. An item already saved today for the same forecast date is skipped, so a rerun on the same day is harmless.

---

## 4. AI adjustment

Pipeline: `lib/ai/sync.ts`. Council: `lib/ai/council.ts`. Stages: `lib/ai/ingest.ts`, `screener.ts`, `cycle1.ts`, `cycle2.ts`. Math: `lib/forecast/aiForecast.ts`.

### 4.1 When it runs

| Trigger | Scope | Entry point |
| --- | --- | --- |
| Manual | `news` by default, `full` on request | `POST /api/sync-runs` |
| Hourly | `news` | `POST /api/sync-runs/scheduled` with `trigger: "hourly"` |
| Daily | `full` | `POST /api/sync-runs/scheduled` with `trigger: "daily"` |

The scheduled endpoint requires `Authorization: Bearer <CRON_SECRET>`.

Both endpoints insert a `sync_runs` row, return it immediately, and run the pipeline after the response. Only one run can be active. A run older than 300 seconds is marked failed with "Timed out" when the next run starts.

### 4.2 Pipeline stages

| Stage | What happens |
| --- | --- |
| `algorithmic_forecast` | Scope `full` only. The arithmetic run from section 3.5. |
| `fetching_news` | Fetches the 20 latest WHO Disease Outbreak News items and upserts them by URL, so only unseen articles count as new. A failed source is logged and does not stop the run. |
| `reusing_last_verdict` | Taken when there are no new articles and none pending. See section 4.5. The run ends here. |
| `screening` | One LLM call marks up to 50 pending articles `selected` or `rejected`, with a summary, impact type, regions and affected categories. |
| `cycle1` | Council validates each selected article that has no verdict yet. |
| `cycle2` | Council returns a usage adjustment per item. |
| `done` | Run marked succeeded with `stock_as_of`. |

After `screening` and after `cycle1`, the run's total LLM cost is checked. Above 1 USD the run fails.

### 4.3 The council

Used by both cycles.

1. **Opinions.** Four members answer independently and in parallel. Each has a persona and a different model. An opinion that does not cover every requested article or item is discarded. At least two complete opinions are needed, or the cycle fails.
2. **Peer review.** Each member whose opinion was kept critiques and ranks the others' answers, which are shown under shuffled labels A to D.
3. **Decision.** A chairman with no persona receives every opinion and review, and decides. Its prompt says not to average or follow the majority.

| Role | Model |
| --- | --- |
| Screener | `anthropic/claude-haiku-5.5` |
| Members | `anthropic/claude-haiku-5.5`, `deepseek/deepseek-v4.1-flash`, `mistralai/mistral-large-4-0`, `z-ai/glm-5.3-flash` |
| Chairman | `anthropic/claude-sonnet-5.5` |

All calls go through OpenRouter, request JSON matching a schema, and are logged to `llm_calls`. Every system prompt tells the model to treat news content as data, never instructions.

### 4.4 The two cycles

**Cycle 1: news validation**

- Personas: Skeptic, Sentinel, Source credibility analyst, Public health and supply risk analyst.
- Input: unvalidated articles, the hospital location, item categories, and news from the last 60 days with its previous verdicts as context.
- Output per article: `valid`, `severity` (1 to 5), `impact_type` (demand, supply, both, none), `regions`, `affected_categories`, `reasoning`. Saved to `news_verdicts`.

**Cycle 2: forecast adjustment**

- Personas: Hoarder, Budget/waste controller, Demand analyst, Supply analyst.
- Input per item: name, category, criticality, shelf life, stock on hand, open orders, and the arithmetic forecast (usage on days 1, 7, 14 and 30, threshold, threshold date, stockout date, cover days, buy quantity, safety stock). Plus every validated article from the last 60 days.
- Output per item: `usage_multiplier` (positive, no upper limit), `fade_days` (integer or null), `confidence` (0 to 1), `reasoning`.
- The prompt forbids absolute quantities and dates.

### 4.5 Turning the multiplier into numbers

- **Multiplier on day h:**
  - No `fade_days`: the multiplier holds.
  - With `fade_days`: `1 + (m − 1) · max(0, 1 − (h + elapsedDays) / fadeDays)`. It decays linearly back to 1.
- **AI usage on day h** = arithmetic `usage(h)` × multiplier on day h.
- The stock projection from section 3.4 is rerun with the AI usage curve.
- **AI threshold** = `reorder_level` if set, otherwise AI usage over the lead time + the arithmetic safety stock.
- **AI buy quantity** = AI usage over `cover_days` + the arithmetic safety stock.
- Saved to `ai_forecasts` with the threshold date, stockout date and triggered flag.

**Reuse path.** When there is no news to process, the most recent multiplier per item is re-applied to the latest arithmetic forecast. `elapsedDays` is the gap between the forecast date the multiplier was based on and the current forecast date, so a fading effect keeps fading. The new row has `council_run_id` null, `source_ai_forecast_id` set, and the AI fields (multiplier, fade, confidence, reasoning) left null. No LLM is called.

### 4.6 Reading both lines

`GET /api/forecasts/[id]` returns, for one item, the stock history (last 42 days), the arithmetic line and the AI line. Both lines are rebuilt from the saved rows and shifted forward by the number of days since the forecast was made, so the projection always starts from the latest recorded stock.

---

## 5. Purchase orders

### 5.1 Automated creation

Entry point: `POST /api/purchase-orders/automated`, body `{ "dry_run": boolean }` (optional, default false).
Logic: `planRestockOrders` in `lib/orders/restockPlan.ts`. Writes: `lib/orders/automatedPurchaseOrders.ts`.

For each item:

1. **Skip** (`open-order`) if it already has a `Pending` or `In transit` order.
2. Compute the arithmetic forecast and stock projection live. **Skip** (`no-history`) if there is no usable history.
3. **Skip** (`above-threshold`) unless the projection reaches the threshold within the lead time. Lead time is rounded up with a minimum of 1 day.
4. **Quantity** = `ceil(30 days of forecast usage − stock on hand)`. **Skip** (`enough-stock`) if zero or less.
5. Record the line with its reasons: on hand, weekly forecast, recent usage, threshold, trigger date, lead days.

Then:

- Lines are grouped by the item's primary supplier into one order each.
- `order_date` = today. `expected_receipt_date` = today + the longest lead time among the order's lines.
- Each line becomes a `purchase_orders` row with `status: "Pending"` and `created_by: "AiGIS"`.
- An order with more than one line gets a `po_documents` row. Documents are written first; if the line insert fails they are deleted again.
- With `dry_run: true` the same plan is returned and nothing is written.

The response lists the planned orders, the skipped items with reasons, and the created PO numbers.

It is triggered from the "Sync now" button on the Predictions page.

### 5.2 Reading and editing

| Action | Endpoint |
| --- | --- |
| List, newest first, 100 per page | `GET /api/purchase-orders` |
| Create one manual line | `POST /api/purchase-orders` |
| Read one line | `GET /api/purchase-orders/[id]` |
| Update one line | `PATCH /api/purchase-orders/[id]` |
| Save a whole order | `PUT /api/purchase-orders/[id]` |
| Delete one line | `DELETE /api/purchase-orders/[id]` |

- The client pages through the list until a page comes back short. The Dashboard, Inventory, Orders and Predictions views all read it this way.
- `PUT` writes the header fields to every line, adds lines that have no `po_id`, and removes existing lines left out. A second line creates a `po_documents` row. When the status is `Delivered`, `qty_received` defaults to `qty_ordered`.
- The Orders page filters by creator (AiGIS or Manual; a null `created_by` counts as Manual) and by status.

### 5.3 Display status

Derived in the UI by `getPurchaseOrderDisplayStatus` in `lib/data/purchaseOrders.ts`.

| Stored status | Shown as |
| --- | --- |
| `Pending` | Pending |
| `Cancelled` | Cancelled |
| `Delivered` | Received, with the receipt date and any shortfall |
| `In transit`, expected date in the future | On the way |
| `In transit`, expected today | Due today |
| `In transit`, expected date passed | Delayed, with days late |

### 5.4 How orders feed back into the forecast

- `In transit` orders are the arrivals in the stock projection.
- `Delivered` orders set the measured lead time, which drives safety stock and the reorder point.
- `Pending` and `In transit` orders block a new automated order for the same item.

---

## 6. Accuracy

Logic: `lib/forecast/accuracy.ts`. Endpoint: `GET /api/forecast-accuracy`.

Accuracy is computed on every request. Nothing is stored.

### 6.1 Per item

1. **Weekly actuals.** Daily demand is summed into Monday-start weeks. Only weeks with all 7 days are kept.
2. **Backtest.** For every complete week with at least 28 days of history before it, the arithmetic forecast is rerun on only the earlier rows. Its usage over 7 days is the prediction.
3. **Saved runs replace the backtest** for their week, since they are what was actually predicted. Later runs for the same week win.
   - Arithmetic quantity = `usage_per_day × 7`.
   - If an AI run used that forecast: AI quantity = arithmetic quantity × multiplier, and the scored prediction is the average of the two.
   - Otherwise the scored prediction is the arithmetic quantity.
4. **Score per week** = `max(0, 100 − |predicted − actual| / actual × 100)`. A week with zero actual demand scores 100.
5. **Item summary:** mean weekly accuracy, average miss in units, weeks within 10% (score ≥ 90), weeks scored, weeks scored with AI, and AI runs whose week has not finished yet.

Items with no scored week are left out. The list is sorted most accurate first.

### 6.2 Overall

Computed in the dashboard by `buildOverallAccuracy`.

- Each week's accuracy is the mean of the item scores for that week. Averaging scores, not totals, stops one item's over-forecast hiding another's under-forecast.
- The overall figure is the mean of the weekly values.
- The dashboard KPI card shows the mean of the per-item accuracies.

---

## 7. End-to-end flow

1. Daily stock rows are written to `daily_inventory`.
2. A daily scheduled call hits `/api/sync-runs/scheduled` with `trigger: "daily"`. A `sync_runs` row is created as running.
3. Actuals are filled on old forecasts, then new `demand_forecasts` rows are saved (section 3).
4. News is fetched. If nothing is new or pending, the last multiplier is reused and the run ends (section 4.5).
5. Otherwise: screening, cycle 1 verdicts, cycle 2 multipliers, then `ai_forecasts` rows (section 4).
6. The run is marked succeeded with `stock_as_of`.
7. Hourly scheduled calls repeat steps 4 to 6 only.
8. The Predictions page reads `GET /api/forecasts/[id]` per item and draws the arithmetic and AI run-down lines.
9. "Sync now" calls `POST /api/purchase-orders/automated` (section 5.1).
10. Staff move orders from Pending to In transit to Delivered on the Orders page. Deliveries change the next forecast's lead time and stock.
11. The dashboard calls `GET /api/forecast-accuracy` and shows the scores (section 6).

---

## 8. Known gaps

Found while tracing the code. None have been confirmed by running it.

| # | Gap | Where |
| --- | --- | --- |
| 1 | The Predictions page run list is mock data. "Sync now" adds a fake run in the browser and nothing in the UI calls `/api/sync-runs`. Only the purchase order call is real. | `components/providers/PredictionsProvider.tsx`, `lib/mock/` |
| 2 | No scheduler is in the repo. There is no cron configuration and `CRON_SECRET` is missing from `.env.example`, so the hourly and daily triggers depend on something external. | `app/api/sync-runs/scheduled/route.ts` |
| 3 | The AI adjustment does not affect purchase orders. The restock plan uses only the arithmetic forecast. The AI buy quantity is stored and displayed but never ordered from. | `lib/orders/restockPlan.ts` |
| 4 | Automated order quantity ignores safety stock. The saved `buy_qty` is cover usage + safety stock, but the automated order is 30-day usage − stock on hand, and uses a fixed 30 days in place of the item's `cover_days`. | `lib/orders/restockPlan.ts` |
| 5 | Stale comments say the restock trigger is "30% of supply". The code uses `reorder_level` or the reorder point. | `lib/orders/restockPlan.ts`, `lib/forecast/usage.ts` |
| 6 | The `onOrder` subtraction in the restock plan is always 0, because items with open orders are skipped before it. | `lib/orders/restockPlan.ts` |
| 7 | Likely accuracy bug. A reused AI row has a null multiplier and points at the same arithmetic forecast as the real cycle 2 row. The accuracy route keeps the newest AI row per forecast, so a later no-news sync appears to erase the multiplier and that week is scored as arithmetic only. | `app/api/forecast-accuracy/route.ts` |
| 8 | `demand_forecasts.actual_qty` is filled by the forecast run but never read. Accuracy recomputes actuals from `daily_inventory`. | `lib/forecast/run.ts`, `lib/forecast/accuracy.ts` |
| 9 | A saved run's weekly figure is `usage_per_day × 7`, which ignores the trend. The backtest for other weeks sums the 7-day curve. The two are not the same measure. | `lib/forecast/accuracy.ts` |
| 10 | An older weekly forecast path still exists with no UI caller. It writes `demand_forecast_backtests`. | `app/api/demand-forecasts/route.ts`, `lib/forecast/holtWma.ts`, `lib/forecast/generateForecasts.ts` |
| 11 | Only one news source has a fetcher registered. | `lib/ai/ingest.ts` |

---

## 9. API reference

Endpoints covered by this document.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/forecasts` | Live arithmetic forecast for every item. Not saved. |
| `POST` | `/api/forecasts` | Run and save the arithmetic forecast. |
| `GET` | `/api/forecasts/[id]` | One item's history, arithmetic line and AI line. |
| `GET` | `/api/forecast-accuracy` | Weekly accuracy per item. |
| `GET` | `/api/sync-runs` | List sync runs. |
| `POST` | `/api/sync-runs` | Start a manual sync. Body: `{ "scope": "news" \| "full" }`. |
| `GET` | `/api/sync-runs/[id]` | One sync run with its cost. |
| `POST` | `/api/sync-runs/scheduled` | Start a scheduled sync. Body: `{ "trigger": "hourly" \| "daily" }`. Needs the cron secret. |
| `POST` | `/api/purchase-orders/automated` | Raise automated orders. Body: `{ "dry_run": boolean }`. |
| `GET`, `POST` | `/api/purchase-orders` | List or create order lines. |
| `GET`, `PATCH`, `PUT`, `DELETE` | `/api/purchase-orders/[id]` | Read, update, save whole order, delete. |

Environment variables used by these paths: `OPENROUTER_API_KEY`, `CRON_SECRET`, and the Supabase keys in `.env.example`.
