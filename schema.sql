-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.facilities (
  facility_id bigint NOT NULL,
  facility_name text,
  facility_type text,
  sector text,
  district text,
  state text,
  size_tier text,
  CONSTRAINT facilities_pkey PRIMARY KEY (facility_id)
);
CREATE TABLE public.suppliers (
  supplier_id bigint NOT NULL,
  supplier_name text,
  supplier_type text,
  state text,
  lead_time_days bigint,
  reliability_score double precision,
  CONSTRAINT suppliers_pkey PRIMARY KEY (supplier_id)
);
CREATE TABLE public.items (
  item_id bigint NOT NULL,
  item_name text,
  category text,
  unit text,
  unit_cost_myr double precision,
  shelf_life_months bigint,
  is_critical bigint,
  storage text,
  primary_supplier_id bigint,
  CONSTRAINT items_pkey PRIMARY KEY (item_id),
  CONSTRAINT items_primary_supplier_id_fkey FOREIGN KEY (primary_supplier_id) REFERENCES public.suppliers(supplier_id)
);
CREATE TABLE public.haze_api_weekly (
  facility_id bigint NOT NULL,
  week_start text NOT NULL,
  api_avg bigint,
  api_category text,
  CONSTRAINT haze_api_weekly_pkey PRIMARY KEY (facility_id, week_start),
  CONSTRAINT haze_api_weekly_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id)
);
CREATE TABLE public.weekly_inventory (
  record_id bigint NOT NULL,
  facility_id bigint,
  item_id bigint,
  week_start text,
  opening_stock bigint,
  received_qty bigint,
  issued_qty bigint,
  unmet_demand_qty bigint,
  wastage_qty bigint,
  closing_stock bigint,
  reorder_level bigint,
  weeks_of_cover double precision,
  stockout_flag bigint,
  haze_api_avg bigint,
  CONSTRAINT weekly_inventory_pkey PRIMARY KEY (record_id),
  CONSTRAINT weekly_inventory_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id),
  CONSTRAINT weekly_inventory_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);
CREATE TABLE public.purchase_orders (
  po_id bigint NOT NULL,
  facility_id bigint,
  item_id bigint,
  supplier_id bigint,
  order_date text,
  qty_ordered bigint,
  unit_cost_myr double precision,
  expected_receipt_date text,
  actual_receipt_date text,
  qty_received bigint,
  status text,
  CONSTRAINT purchase_orders_pkey PRIMARY KEY (po_id),
  CONSTRAINT purchase_orders_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id),
  CONSTRAINT purchase_orders_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id),
  CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(supplier_id)
);
CREATE TABLE public.batches (
  batch_id bigint NOT NULL,
  facility_id bigint,
  item_id bigint,
  lot_no text,
  quantity bigint,
  received_date text,
  expiry_date text,
  CONSTRAINT batches_pkey PRIMARY KEY (batch_id),
  CONSTRAINT batches_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facilities(facility_id),
  CONSTRAINT batches_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(item_id)
);