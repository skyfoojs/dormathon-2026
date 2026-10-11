-- WARNING: This schema is for context only and is not meant to be run.
-- Source of truth = the live Supabase DB (changes go through migrations).
-- Mirrors the live DB as of 2026-10-10 (demand_forecasts = after the daily-model migration).
--
-- Conventions:
--   - Single hospital, no login. facilities exists from the original dataset but is ignored by new code.
--   - Dates are text 'YYYY-MM-DD' (matches the original tables); event times are timestamptz.
--   - All tables have RLS enabled with no policies; the app uses the service role.
--   - "user input" = typed in by hospital staff; "calculated" = written by code.


-- =====================================================================
-- CORE CATALOG
-- =====================================================================

-- Original dataset. Ignored by new code (single hospital). The hospital = facility 7 (Selangor, Petaling).
CREATE TABLE public.facilities (
  facility_id bigint NOT NULL,
  facility_name text,
  facility_type text,                  -- e.g. Hospital, Clinic
  sector text,                         -- Public | Private
  district text,
  state text,
  size_tier text,                      -- Large | Medium | Small
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT facilities_pkey PRIMARY KEY (facility_id)
);

CREATE TABLE public.suppliers (
  supplier_id bigint NOT NULL,
  supplier_name text,
  supplier_type text,                  -- Consumables & PPE | Diagnostics | Equipment | Medical Gas | Pharma Distributor
  state text,                          -- Malaysian state the supplier is in
  lead_time_days bigint,               -- usual days from order to delivery
  reliability_score double precision,  -- 0-1, how reliably they deliver in full and on time
  country text,                        -- supplier country (all 'Malaysia' for now); for supply-side news matching
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT suppliers_pkey PRIMARY KEY (supplier_id)
);

-- One row per stock item. Holds the user's per-item settings.
CREATE TABLE public.items (
  item_id bigint NOT NULL,
  item_name text,
  category text,                       -- Consumable | Diagnostics | Equipment | IV Fluid | Medical Gas | Medication | PPE
  unit text,                           -- unit of measure: box, vial, tablet, cylinder, ...
  unit_cost_myr double precision,
  shelf_life_months bigint,
  is_critical bigint,                  -- 1 = running out is dangerous, 0 = not
  storage text,                        -- Ambient | Cold chain (2-8C) | Gas store
  primary_supplier_id bigint,
  cover_days integer DEFAULT 30 CHECK (cover_days > 0),  -- user input: how many days one purchase should last (default 30). Buy amount = usage over cover_days + safety stock, calculated live
  reorder_level double precision DEFAULT 0 CHECK (reorder_level >= 0),  -- user input: restock threshold in units (default 0). NULL = use the forecast's reorder point
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT items_pkey PRIMARY KEY (item_id),
  CONSTRAINT items_primary_supplier_id_fkey FOREIGN KEY (primary_supplier_id) REFERENCES public.suppliers(supplier_id)
);


-- =====================================================================
-- INVENTORY (actuals)
-- Daily identity: closing = opening + received - issued - wastage
-- =====================================================================

-- One row per item per day. Latest row per item = current stock left.
CREATE TABLE public.daily_inventory (
  record_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  facility_id bigint,                  -- always the single hospital; ignore
  item_id bigint,
  inventory_date text NOT NULL,        -- the day this row describes
  opening_stock bigint,                -- calculated: = previous day's closing_stock
  received_qty bigint,                 -- user input (or from purchase_orders.qty_received): good units delivered that day
  issued_qty bigint,                   -- user input: units used / given out that day. Basis of the usage rate
  unmet_demand_qty bigint,             -- user input: units wanted but not available (stock was 0)
  wastage_qty bigint,                  -- user input: units thrown away (expired, damaged)
  closing_stock bigint,                -- stock left at end of day. THE "how much do I have left" number
  reorder_level bigint,                -- original dataset's per-item threshold (constant per item). Not read by code; items.reorder_level replaces it
  stockout_flag bigint,                -- calculated: 1 if the item ran out that day
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT daily_inventory_pkey PRIMARY KEY (record_id),
  CONSTRAINT daily_inventory_facility_id_item_id_inventory_date_key UNIQUE (facility_id, item_id, inventory_date),
  CONSTRAINT daily_inventory_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id),
  CONSTRAINT daily_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);
CREATE INDEX daily_inventory_item_date_idx ON public.daily_inventory (item_id, inventory_date);

-- Original dataset, weekly roll-up. Same meaning as daily_inventory but per week. Redundant with daily_inventory.
CREATE TABLE public.weekly_inventory (
  record_id bigint NOT NULL,
  facility_id bigint,
  item_id bigint,
  week_start text,                     -- Monday of the week
  opening_stock bigint,
  received_qty bigint,
  issued_qty bigint,
  unmet_demand_qty bigint,
  wastage_qty bigint,
  closing_stock bigint,
  reorder_level bigint,
  weeks_of_cover double precision,     -- calculated: closing_stock / weekly usage
  stockout_flag bigint,
  haze_api_avg bigint,                 -- copy of that week's haze index (see haze_api_weekly)
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT weekly_inventory_pkey PRIMARY KEY (record_id),
  CONSTRAINT weekly_inventory_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id),
  CONSTRAINT weekly_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);

-- Stock lots with expiry. One row per received lot.
CREATE TABLE public.batches (
  batch_id bigint NOT NULL,
  facility_id bigint,
  item_id bigint,
  lot_no text,                         -- supplier lot / batch number
  quantity bigint,                     -- user input on receipt: units in this lot
  received_date text,
  expiry_date text,
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT batches_pkey PRIMARY KEY (batch_id),
  CONSTRAINT batches_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id),
  CONSTRAINT batches_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);


-- =====================================================================
-- PURCHASING
-- =====================================================================

-- Purchase request document (Malaysian government procurement form) with HOD + finance approval.
CREATE TABLE public.po_documents (
  po_doc_id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  po_number text NOT NULL UNIQUE,
  requester_name text NOT NULL,
  requester_position text,
  description text,
  procurement_method text NOT NULL DEFAULT 'PEMBELIAN TERUS'
    CHECK (procurement_method IN ('PEMBELIAN TERUS', 'SEBUT HARGA', 'TENDER')),  -- direct purchase | quotation | tender
  requested_at date NOT NULL DEFAULT CURRENT_DATE,
  is_repeat_purchase boolean NOT NULL DEFAULT false,
  previous_purchase_value_myr numeric, -- only when is_repeat_purchase
  budget_object_code text,             -- budget line the purchase is charged to
  budget_balance_myr numeric,          -- budget left on that line
  hod_decision text CHECK (hod_decision IN ('DILULUSKAN', 'TIDAK DILULUSKAN')),  -- head of dept: approved | not approved
  hod_name text,
  hod_position text,
  hod_decided_at date,
  finance_decision text CHECK (finance_decision IN ('DILULUSKAN', 'DITOLAK')),   -- finance: approved | rejected
  finance_officer_name text,
  finance_officer_position text,
  finance_decided_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT po_documents_pkey PRIMARY KEY (po_doc_id),
  CONSTRAINT po_documents_previous_value_check CHECK (is_repeat_purchase OR previous_purchase_value_myr IS NULL)
);

-- One row per item ordered.
CREATE TABLE public.purchase_orders (
  po_id bigint NOT NULL,
  facility_id bigint,
  item_id bigint,
  supplier_id bigint,
  order_date text,
  qty_ordered bigint,                  -- user input: units ordered
  unit_cost_myr double precision,
  expected_receipt_date text,
  actual_receipt_date text,
  qty_received bigint,                 -- user input: good units actually delivered (shortfall = qty_ordered - qty_received)
  status text,                         -- 'In transit' (open order) | 'Delivered'
  po_doc_id bigint,                    -- the request document this order belongs to
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (po_id),
  CONSTRAINT purchase_orders_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id),
  CONSTRAINT purchase_orders_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id),
  CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(supplier_id),
  CONSTRAINT purchase_orders_po_doc_id_fkey FOREIGN KEY (po_doc_id) REFERENCES public.po_documents(po_doc_id)
);
CREATE INDEX purchase_orders_po_doc_id_idx ON public.purchase_orders (po_doc_id);


-- =====================================================================
-- ALGORITHMIC FORECAST (daily model, lib/forecast/demand.ts; adapts docs/Internal-Calculation.md from weeks to days)
-- Level, trend and wma_qty are for an average day: the day-of-week pattern is divided out before forecasting.
-- Usage on day h = w * max(level + trend * (phi + phi^2 + ... + phi^h), 0) + (1 - w) * wma_qty
-- Buy when actual stock left <= threshold (items.reorder_level, else usage over lead_days + safety_stock).
-- Buy amount = usage over cover_days + safety_stock.
-- =====================================================================

-- One row per item per forecast run. A snapshot: never recomputed, so later comparisons use what was predicted then.
CREATE TABLE public.demand_forecasts (
  forecast_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  item_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the forecast was run
  forecast_date text NOT NULL,         -- first forecast day (day after stock_as_of)
  history_days integer,                -- days of usage history used
  alpha double precision,              -- Holt level smoothing: how fast it reacts to the latest usage
  beta double precision,               -- Holt trend smoothing: how fast it reacts to a changing trend
  phi double precision,                -- trend damping (0.95): the trend fades so it can't run away over long horizons
  holt_level double precision,         -- Holt's smoothed daily usage at the last actual day
  holt_trend double precision,         -- Holt's smoothed change in daily usage per day (what bends the projected line)
  wma_qty double precision,            -- 56-day weighted moving average of daily usage (newest day weighs most)
  holt_weight double precision,        -- w: share given to Holt vs WMA (0.25-0.75, by which predicted 7-day totals better)
  usage_per_day double precision NOT NULL,  -- forecast usage for forecast_date (day 1). Cycle 2 compares against this
  sigma double precision,              -- std dev of daily usage / forecast error (how much usage swings)
  z double precision,                  -- service-level factor: 2.05 critical items (98%), 1.65 others (95%)
  lead_days double precision,          -- supplier delivery time in days (from this item's delivered POs)
  safety_stock double precision,       -- buffer = z * sigma * sqrt(lead_days)
  stock_left bigint,                   -- actual stock left (closing_stock) at stock_as_of
  stock_as_of text,                    -- date of the last actual count used
  threshold double precision,          -- restock trigger used: items.reorder_level, else reorder point = usage over lead_days + safety_stock
  threshold_date text,                 -- predicted day stock hits threshold (NULL = not within 12 weeks)
  stockout_date text,                  -- predicted day stock hits 0 (NULL = not within 12 weeks)
  triggered boolean NOT NULL DEFAULT false,  -- actual stock left is already <= threshold: buy now
  cover_days integer,                  -- days the purchase should last (items.cover_days, default 30)
  buy_qty double precision,            -- buy amount = forecast usage over cover_days + safety_stock
  actual_qty bigint,                   -- real usage on forecast_date, filled later to measure accuracy
  CONSTRAINT demand_forecasts_pkey PRIMARY KEY (forecast_id),
  CONSTRAINT demand_forecasts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);
CREATE INDEX demand_forecasts_item_created_idx ON public.demand_forecasts (item_id, created_at DESC);


-- =====================================================================
-- EXTERNAL NUMERIC TRACKERS (haze, covid, flu ...)
-- =====================================================================

-- One row per external numeric data source. Dev hardcodes a fetcher per tracker.
-- Only one tracker for now: "Haze (Air Pollutant Index)" (WAQI live US AQI, saved on every sync; replaced haze_api_weekly).
CREATE TABLE public.trackers (
  tracker_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  url text,                            -- API endpoint
  unit text,                           -- e.g. cases, API index
  region text,                         -- area the numbers cover
  categories text[],                   -- item categories it relates to
  frequency text NOT NULL CHECK (frequency IN ('hourly', 'daily')),  -- which sync fetches it
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT trackers_pkey PRIMARY KEY (tracker_id)
);

-- Time series of tracker values.
CREATE TABLE public.tracker_readings (
  reading_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tracker_id bigint NOT NULL,
  metric text NOT NULL,                -- which number (cases, deaths, ...) when one API returns several
  recorded_at text NOT NULL,           -- when the value applies (from the source)
  value double precision,
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT tracker_readings_pkey PRIMARY KEY (reading_id),
  CONSTRAINT tracker_readings_tracker_id_metric_recorded_at_key UNIQUE (tracker_id, metric, recorded_at),
  CONSTRAINT tracker_readings_tracker_id_fkey FOREIGN KEY (tracker_id) REFERENCES public.trackers(tracker_id)
);


-- =====================================================================
-- AI PIPELINE: sync -> fetch news -> screener -> Cycle 1 council -> Cycle 2 council
-- See ai-part.md
-- =====================================================================

-- One row per sync (manual / hourly / daily).
CREATE TABLE public.sync_runs (
  sync_run_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('manual', 'hourly', 'daily')),
  scope text NOT NULL CHECK (scope IN ('news', 'full')),  -- news = news + councils only; full = also reruns the algorithmic forecast
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  stage text,                          -- current step, for the UI progress display
  error text,                          -- why it failed
  stock_as_of text,                    -- date of the inventory data the run used ("stock data as of X")
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT sync_runs_pkey PRIMARY KEY (sync_run_id)
);
-- Lock: at most one queued/running sync at a time.
CREATE UNIQUE INDEX sync_runs_one_active_idx ON public.sync_runs ((true)) WHERE status IN ('queued', 'running');

-- Hardcoded news feeds. A code fetcher is registered per name (lib/ai/ingest.ts).
CREATE TABLE public.news_sources (
  source_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  feed_url text NOT NULL UNIQUE,
  tier smallint NOT NULL CHECK (tier BETWEEN 1 AND 4),  -- 1 official health, 2 surveillance/disaster, 3 reputable news, 4 tabloid
  region text,                         -- area the source covers (GLOBAL, MY, ...)
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT news_sources_pkey PRIMARY KEY (source_id)
);

-- One per council run (Cycle 1 or 2). Declared before llm_calls because seats are referenced there.
CREATE TABLE public.council_runs (
  council_run_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sync_run_id bigint NOT NULL,
  cycle smallint NOT NULL CHECK (cycle IN (1, 2)),  -- 1 = validate news, 2 = inventory direction
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT council_runs_pkey PRIMARY KEY (council_run_id),
  CONSTRAINT council_runs_sync_run_id_cycle_key UNIQUE (sync_run_id, cycle),
  CONSTRAINT council_runs_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES public.sync_runs(sync_run_id)
);

-- The 4 members + chairman of a council run.
CREATE TABLE public.council_seats (
  seat_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  council_run_id bigint NOT NULL,
  role text NOT NULL CHECK (role IN ('member', 'chairman')),
  persona text NOT NULL,               -- e.g. Skeptic, Hoarder; 'Chairman' for the chairman
  label text,                          -- anonymised name in peer review (A-D, shuffled per run); NULL for chairman
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT council_seats_pkey PRIMARY KEY (seat_id),
  CONSTRAINT council_seats_check CHECK ((role = 'chairman') = (label IS NULL)),
  CONSTRAINT council_seats_council_run_id_label_key UNIQUE (council_run_id, label),
  CONSTRAINT council_seats_council_run_id_persona_key UNIQUE (council_run_id, persona),
  CONSTRAINT council_seats_council_run_id_fkey FOREIGN KEY (council_run_id) REFERENCES public.council_runs(council_run_id)
);

-- Every AI call (screener, member opinion/review, chairman decision). Raw output kept for audit.
-- A council message = a row with seat_id + stage. Run cost = sum(cost_usd) per sync_run_id.
CREATE TABLE public.llm_calls (
  call_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sync_run_id bigint NOT NULL,
  seat_id bigint,                      -- NULL for the screener
  stage text CHECK (stage IN ('opinion', 'review', 'decision')),  -- NULL for the screener
  model text NOT NULL,                 -- OpenRouter model id. Internal only, never shown to the user
  tokens_in integer,
  tokens_out integer,
  cost_usd double precision,
  output jsonb,                        -- parsed JSON answer, or {"raw": text} if it didn't match the schema
  error text,                          -- set if the call failed or output was invalid
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT llm_calls_pkey PRIMARY KEY (call_id),
  CONSTRAINT llm_calls_check CHECK ((seat_id IS NULL) = (stage IS NULL)),
  CONSTRAINT llm_calls_seat_id_stage_key UNIQUE (seat_id, stage),
  CONSTRAINT llm_calls_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES public.sync_runs(sync_run_id),
  CONSTRAINT llm_calls_seat_id_fkey FOREIGN KEY (seat_id) REFERENCES public.council_seats(seat_id)
);
CREATE INDEX llm_calls_sync_run_idx ON public.llm_calls (sync_run_id);

-- Every fetched news item + the screener's result. Unique url = dedup.
CREATE TABLE public.articles (
  article_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  source_id bigint NOT NULL,
  sync_run_id bigint NOT NULL,         -- the sync that first fetched it
  url text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,                    -- summary text from the source
  published_at timestamptz,            -- from the source; used for news age
  fetched_at timestamptz NOT NULL DEFAULT now(),
  screen_status text NOT NULL DEFAULT 'pending'
    CHECK (screen_status IN ('pending', 'selected', 'rejected')),  -- pending = not screened yet (retried next sync)
  screen_call_id bigint,               -- the screener call that judged it
  summary text,                        -- screener summary (selected only)
  reject_reason text,                  -- why the screener dropped it (rejected only)
  impact_type text CHECK (impact_type IN ('demand', 'supply', 'both', 'none')),  -- screener tag
  regions text[],                      -- screener tag: ISO alpha-2 codes or GLOBAL
  affected_categories text[],          -- screener tag: items.category values
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT articles_pkey PRIMARY KEY (article_id),
  CONSTRAINT articles_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.news_sources(source_id),
  CONSTRAINT articles_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES public.sync_runs(sync_run_id),
  CONSTRAINT articles_screen_call_id_fkey FOREIGN KEY (screen_call_id) REFERENCES public.llm_calls(call_id)
);
CREATE INDEX articles_status_published_idx ON public.articles (screen_status, published_at DESC);

-- Cycle 1 chairman verdict per article (the parsed, trusted result).
CREATE TABLE public.news_verdicts (
  council_run_id bigint NOT NULL,
  article_id bigint NOT NULL,
  valid boolean NOT NULL,              -- is the news credible / real
  severity smallint CHECK (severity BETWEEN 1 AND 5),  -- impact on this hospital: 1 negligible .. 5 critical
  impact_type text CHECK (impact_type IN ('demand', 'supply', 'both', 'none')),
  regions text[],
  affected_categories text[],
  reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT news_verdicts_pkey PRIMARY KEY (council_run_id, article_id),
  CONSTRAINT news_verdicts_council_run_id_fkey FOREIGN KEY (council_run_id) REFERENCES public.council_runs(council_run_id),
  CONSTRAINT news_verdicts_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(article_id)
);
CREATE INDEX news_verdicts_article_idx ON public.news_verdicts (article_id);

-- AI forecast (algorithmic + news) per item per sync. The AI's usage multiplier scales the
-- algorithmic usage curve (lib/forecast/aiForecast.ts); code projects its stock-left path, dates and buy amount.
CREATE TABLE public.ai_forecasts (
  ai_forecast_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sync_run_id bigint NOT NULL,
  item_id bigint NOT NULL,
  forecast_id bigint NOT NULL,         -- algorithmic forecast it scales (gives curve, stock, lead/cover days, safety stock, actual)
  council_run_id bigint,               -- Cycle 2 run that produced it; NULL when reused (no new news)
  source_ai_forecast_id bigint,        -- no-new-news path: the earlier AI forecast being reused (AI fields not copied)
  usage_multiplier double precision CHECK (usage_multiplier > 0),  -- AI: x algorithmic usage. >1 more, <1 less. No upper limit
  fade_days integer CHECK (fade_days > 0),  -- AI: days until the multiplier fades back to x1 (linear). NULL = holds
  confidence double precision CHECK (confidence BETWEEN 0 AND 1),  -- AI
  reasoning text,                      -- AI
  threshold double precision,          -- code: items.reorder_level, else AI usage over lead days + safety stock
  threshold_date text,                 -- code: predicted day AI stock hits threshold
  stockout_date text,                  -- code: predicted day AI stock hits 0
  triggered boolean NOT NULL DEFAULT false,  -- code: actual stock left <= threshold
  buy_qty double precision,            -- code: AI usage over cover_days + safety stock
  user_choice text CHECK (user_choice IN ('algorithmic', 'ai')),  -- user input: which forecast they followed
  decided_at timestamptz,              -- when the user chose
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the row was inserted
  CONSTRAINT ai_forecasts_pkey PRIMARY KEY (ai_forecast_id),
  CONSTRAINT ai_forecasts_sync_run_id_item_id_key UNIQUE (sync_run_id, item_id),
  CONSTRAINT ai_forecasts_check CHECK ((user_choice IS NULL) = (decided_at IS NULL)),
  CONSTRAINT ai_forecasts_check1 CHECK (
    (council_run_id IS NOT NULL AND source_ai_forecast_id IS NULL AND usage_multiplier IS NOT NULL AND confidence IS NOT NULL)
    OR
    (council_run_id IS NULL AND source_ai_forecast_id IS NOT NULL AND usage_multiplier IS NULL AND fade_days IS NULL AND confidence IS NULL AND reasoning IS NULL)
  ),
  CONSTRAINT ai_forecasts_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES public.sync_runs(sync_run_id),
  CONSTRAINT ai_forecasts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id),
  CONSTRAINT ai_forecasts_forecast_id_fkey FOREIGN KEY (forecast_id) REFERENCES public.demand_forecasts(forecast_id),
  CONSTRAINT ai_forecasts_council_run_id_fkey FOREIGN KEY (council_run_id) REFERENCES public.council_runs(council_run_id),
  CONSTRAINT ai_forecasts_source_ai_forecast_id_fkey FOREIGN KEY (source_ai_forecast_id) REFERENCES public.ai_forecasts(ai_forecast_id)
);
CREATE INDEX ai_forecasts_item_idx ON public.ai_forecasts (item_id, ai_forecast_id DESC);


-- =====================================================================
-- SCHEDULED SYNCS (pg_cron + pg_net)
-- Jobs: ai-sync-hourly '0 0-21,23 * * *' (news), ai-sync-daily '0 22 * * *' (full; 22:00 UTC = 06:00 MYT).
-- Each calls public.trigger_scheduled_sync(trigger), which POSTs to {vault 'app_url'}/api/sync-runs/scheduled
-- with header Authorization: Bearer {vault 'cron_secret'} (must equal the app's CRON_SECRET env var).
-- =====================================================================
