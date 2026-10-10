-- WARNING: This schema is for context only and is not meant to be run.
-- Source of truth = the live Supabase DB (changes go through migrations).
-- Mirrors the live DB as of 2026-10-10.
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
  cover_days integer CHECK (cover_days > 0),  -- user input: how many days one purchase should last (buy amount = usage/day x cover_days + buffer)
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
  reorder_level bigint,                -- threshold: buy when actual stock left <= this. Constant per item (may move to items)
  stockout_flag bigint,                -- calculated: 1 if the item ran out that day
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
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (po_id),
  CONSTRAINT purchase_orders_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id),
  CONSTRAINT purchase_orders_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id),
  CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(supplier_id),
  CONSTRAINT purchase_orders_po_doc_id_fkey FOREIGN KEY (po_doc_id) REFERENCES public.po_documents(po_doc_id)
);
CREATE INDEX purchase_orders_po_doc_id_idx ON public.purchase_orders (po_doc_id);


-- =====================================================================
-- INTERNAL FORECAST (teammate's math, see docs/Internal-Calculation.md)
-- =====================================================================

-- One row per item per forecast run. A snapshot: never recomputed, so later comparisons use what was predicted then.
CREATE TABLE public.demand_forecasts (
  forecast_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  item_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),  -- when the forecast was run
  target_week_start text NOT NULL,     -- the week being forecast (Monday)
  history_weeks integer,               -- how many past weeks of usage were used
  alpha double precision,              -- Holt level smoothing (0.4): how fast it reacts to the latest usage
  beta double precision,               -- Holt trend smoothing (0.2): how fast it reacts to a changing trend
  holt_qty double precision,           -- Holt forecast of next week's usage (trend-aware)
  wma_qty double precision,            -- 4-week weighted moving average of usage (recent weeks weigh more)
  forecast_qty double precision,       -- (holt_qty + wma_qty) / 2 = predicted usage next week. /7 = usage per day. Cycle 2 input
  sigma double precision,              -- std dev of weekly usage / forecast error (how much usage swings)
  z double precision,                  -- service-level factor (e.g. 1.65 ~ 95% chance of no stockout)
  review_weeks double precision,       -- how often stock is reviewed / reordered
  lead_weeks double precision,         -- supplier delivery time in weeks
  fill_rate double precision,          -- share of an order the supplier actually delivers
  on_hand bigint,                      -- copy of stock left at run time
  on_order bigint,                     -- ordered but not yet arrived at run time
  safety_stock double precision,       -- buffer = z * sigma * sqrt(review_weeks + lead_weeks)
  actual_qty bigint,                   -- real usage of target week, filled later to measure forecast accuracy
  CONSTRAINT demand_forecasts_pkey PRIMARY KEY (forecast_id),
  CONSTRAINT demand_forecasts_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);
CREATE INDEX demand_forecasts_item_created_idx ON public.demand_forecasts (item_id, created_at DESC);


-- =====================================================================
-- EXTERNAL NUMERIC TRACKERS (haze, covid, flu ...)
-- =====================================================================

-- Original dataset. Weekly haze (Air Pollutant Index). May migrate into trackers.
CREATE TABLE public.haze_api_weekly (
  facility_id bigint NOT NULL,
  week_start text NOT NULL,
  api_avg bigint,                      -- average API that week
  api_category text,                   -- Good | Moderate | Unhealthy
  CONSTRAINT haze_api_weekly_pkey PRIMARY KEY (facility_id, week_start),
  CONSTRAINT haze_api_weekly_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id)
);

-- One row per external numeric data source. Dev hardcodes a fetcher per tracker.
CREATE TABLE public.trackers (
  tracker_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL UNIQUE,
  url text,                            -- API endpoint
  unit text,                           -- e.g. cases, API index
  region text,                         -- area the numbers cover
  categories text[],                   -- item categories it relates to
  frequency text NOT NULL CHECK (frequency IN ('hourly', 'daily')),  -- which sync fetches it
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT trackers_pkey PRIMARY KEY (tracker_id)
);

-- Time series of tracker values.
CREATE TABLE public.tracker_readings (
  reading_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tracker_id bigint NOT NULL,
  metric text NOT NULL,                -- which number (cases, deaths, ...) when one API returns several
  recorded_at text NOT NULL,           -- when the value applies (from the source)
  value double precision,
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
  scope text NOT NULL CHECK (scope IN ('news', 'full')),  -- news = news + councils only; full = also reruns internal forecast
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  stage text,                          -- current step, for the UI progress display
  error text,                          -- why it failed
  stock_as_of text,                    -- date of the inventory data the run used ("stock data as of X")
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
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
  CONSTRAINT news_sources_pkey PRIMARY KEY (source_id)
);

-- One per council run (Cycle 1 or 2). Declared before llm_calls because seats are referenced there.
CREATE TABLE public.council_runs (
  council_run_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sync_run_id bigint NOT NULL,
  cycle smallint NOT NULL CHECK (cycle IN (1, 2)),  -- 1 = validate news, 2 = inventory direction
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
  CONSTRAINT news_verdicts_pkey PRIMARY KEY (council_run_id, article_id),
  CONSTRAINT news_verdicts_council_run_id_fkey FOREIGN KEY (council_run_id) REFERENCES public.council_runs(council_run_id),
  CONSTRAINT news_verdicts_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(article_id)
);
CREATE INDEX news_verdicts_article_idx ON public.news_verdicts (article_id);

-- Cycle 2 chairman result per item per sync, next to the internal forecast it was judged against.
CREATE TABLE public.ai_suggestions (
  suggestion_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sync_run_id bigint NOT NULL,
  item_id bigint NOT NULL,
  forecast_id bigint NOT NULL,         -- the internal forecast snapshot shown alongside
  council_run_id bigint,               -- Cycle 2 run that produced it; NULL when reused (no new news)
  source_suggestion_id bigint,         -- no-new-news path: the earlier suggestion being reused (fields not copied)
  direction text CHECK (direction IN ('increase', 'decrease', 'keep')),  -- demand vs the internal forecast
  confidence double precision CHECK (confidence BETWEEN 0 AND 1),
  reasoning text,
  user_choice text CHECK (user_choice IN ('internal', 'ai')),  -- user input: which suggestion they followed
  decided_at timestamptz,              -- when the user chose
  CONSTRAINT ai_suggestions_pkey PRIMARY KEY (suggestion_id),
  CONSTRAINT ai_suggestions_sync_run_id_item_id_key UNIQUE (sync_run_id, item_id),
  CONSTRAINT ai_suggestions_check CHECK ((user_choice IS NULL) = (decided_at IS NULL)),
  CONSTRAINT ai_suggestions_source_check CHECK (
    (council_run_id IS NOT NULL AND source_suggestion_id IS NULL AND direction IS NOT NULL AND confidence IS NOT NULL)
    OR
    (council_run_id IS NULL AND source_suggestion_id IS NOT NULL AND direction IS NULL AND confidence IS NULL AND reasoning IS NULL)
  ),
  CONSTRAINT ai_suggestions_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES public.sync_runs(sync_run_id),
  CONSTRAINT ai_suggestions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id),
  CONSTRAINT ai_suggestions_forecast_id_fkey FOREIGN KEY (forecast_id) REFERENCES public.demand_forecasts(forecast_id),
  CONSTRAINT ai_suggestions_council_run_id_fkey FOREIGN KEY (council_run_id) REFERENCES public.council_runs(council_run_id),
  CONSTRAINT ai_suggestions_source_suggestion_id_fkey FOREIGN KEY (source_suggestion_id) REFERENCES public.ai_suggestions(suggestion_id)
);
CREATE INDEX ai_suggestions_item_idx ON public.ai_suggestions (item_id, suggestion_id DESC);


-- =====================================================================
-- EMAIL ALERTS: UNUSED (email alerts removed for now). Tables exist, empty.
-- =====================================================================

CREATE TABLE public.alert_recipients (
  recipient_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL UNIQUE,
  name text,
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT alert_recipients_pkey PRIMARY KEY (recipient_id)
);

CREATE TABLE public.item_mutes (
  mute_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  item_id bigint NOT NULL,
  baseline_suggestion_id bigint NOT NULL,  -- suggestion at mute time
  muted_at timestamptz NOT NULL DEFAULT now(),
  unmuted_at timestamptz,
  unmute_reason text CHECK (unmute_reason IN ('user', 'internal_rise', 'gap_rise', 'reset')),
  CONSTRAINT item_mutes_pkey PRIMARY KEY (mute_id),
  CONSTRAINT item_mutes_check CHECK ((unmuted_at IS NULL) = (unmute_reason IS NULL)),
  CONSTRAINT item_mutes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id),
  CONSTRAINT item_mutes_baseline_suggestion_id_fkey FOREIGN KEY (baseline_suggestion_id) REFERENCES public.ai_suggestions(suggestion_id)
);
CREATE UNIQUE INDEX item_mutes_one_active_idx ON public.item_mutes (item_id) WHERE unmuted_at IS NULL;

CREATE TABLE public.alert_emails (
  email_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  sync_run_id bigint NOT NULL UNIQUE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  error text,
  CONSTRAINT alert_emails_pkey PRIMARY KEY (email_id),
  CONSTRAINT alert_emails_sync_run_id_fkey FOREIGN KEY (sync_run_id) REFERENCES public.sync_runs(sync_run_id)
);

CREATE TABLE public.alert_items (
  email_id bigint NOT NULL,
  suggestion_id bigint NOT NULL,
  kind text NOT NULL CHECK (kind IN ('gap', 'escalation', 'unmute')),
  CONSTRAINT alert_items_pkey PRIMARY KEY (email_id, suggestion_id),
  CONSTRAINT alert_items_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.alert_emails(email_id),
  CONSTRAINT alert_items_suggestion_id_fkey FOREIGN KEY (suggestion_id) REFERENCES public.ai_suggestions(suggestion_id)
);
