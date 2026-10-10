# AiGIS build prompt

Paste PART 1 first. Then paste one page prompt at a time (PART 2), in the order given. Each page has a matching HTML file in this folder that you must treat as the visual and behavioural reference.

Files in this folder:

| Page | Reference file |
|---|---|
| Dashboard | `dashboard.html` |
| Inventory (items, purchase orders, suppliers) | `inventory.html` |
| Predictions | `predictions.html` |
| Warnings | `warnings.html` |
| Insights | `insights.html` |
| Settings (migrations) | `settings.html` |
| Logo | `aigis-logo.png` |

The HTML files are standalone and interactive (open them in a browser). All sample data in them is mock data. They are a design reference, not production code: do not copy their inline runtime, copy their layout, tokens, states and behaviour.

---

## PART 1. Master prompt (paste first)

You are building the front end of **AiGIS, AI Guardian Intelligence System**: a hospital inventory risk and decision-support system. It watches hospital stock of critical items (respiratory medicines, antivirals, PPE) and combines the hospital's own database with outside signals (haze index, COVID-19 activity, influenza-like illness, other outbreaks) to warn people before an item runs out and to suggest what to order next month.

Who it is for: a hospital pharmacy or supply officer who has to decide what to order and chase today.

The hackathon track is "Predictive Model". The judges ask: does the model help someone make a better decision, and can you prove it? So every screen must show a decision, the evidence behind it, and where the evidence came from.

### Step 0. Inspect the repository before writing code

Do this first and report what you found in a short list before you build anything.

1. Read `package.json` (and the lockfile, `tsconfig`, build config, and the folder structure). Identify:
   - framework and version (React, Next.js, Vue, Laravel with Blade or Inertia, plain JS, other)
   - language (TypeScript or JavaScript)
   - router
   - styling approach (Tailwind, CSS modules, styled-components, a component library such as MUI, Ant Design, Chakra, shadcn/ui)
   - chart library
   - table library
   - form and validation libraries
   - data fetching and state libraries
   - date library
   - icon library
   - test setup
2. **Use what already exists.** If the repo already has a library for any of the jobs above, use it. Do not add a second library that does the same job.
3. **Only if a job has no existing library**, recommend one and say why, then wait for approval before adding it. Use the defaults below unless the repo's stack points elsewhere.

| Job | Default recommendation if nothing exists | Notes |
|---|---|---|
| Charts (line, bar, scatter, control chart) | Recharts if React, otherwise Apache ECharts or Chart.js | Needs reference lines, bands, per-point tooltips |
| Node and link graphs (relationship graph, run graph) | `@xyflow/react` (React Flow) for interactive node graphs, or Cytoscape.js if not React | The designs use fixed layouts with clickable nodes |
| Tables with sort, filter, row actions | TanStack Table | Headless, works with any styling |
| Forms and validation | React Hook Form with Zod | Zod schemas also validate imported data |
| Data fetching and caching | TanStack Query | One query per page section |
| Routing | The framework's router (React Router or Next.js routing) | Sidebar links map to routes |
| UI primitives (dialog, select, tabs, switch, slider) | Radix UI primitives, or shadcn/ui if the repo already uses Tailwind | Needs real keyboard and focus handling |
| Dates | date-fns | Small, tree-shakeable |
| Icons | lucide-react | Matches the line icons in the design |
| Mock data in development | MSW (Mock Service Worker) | Lets pages run before the backend exists |

Do not install anything until you have listed what is already there.

### Step 1. Design tokens (use exactly these)

Colours
- Navy `#0C4B87` (primary, headings accents, active nav)
- Ink `#0A2540` (body text)
- Muted `#4A6078` (secondary text)
- Strong muted `#2B4560`
- Lines `#D6DFE8`, strong line `#6B8199`
- Page background `#F3F6F9`, card `#FFFFFF`
- Light blue `#3DA5E0`, blue tint `#E1F0FA`, blue border `#9CCBEA`
- Red `#D9293B` (alerts, badge, HIGH), dark red text `#B01E2F`
- Amber background `#FDEBC2`, amber text `#5C3A00`, amber border `#E0A92E`
- Green tint `#E3F4EA`, green text `#12633A`, green border `#8FCFA9`
- Violet tint `#E9E5F7`, violet text `#3F2F7A`, violet border `#BDB1DE`

Type
- Body and headings: Archivo, weights 400 to 700
- Numbers, tags, table headers, IDs: IBM Plex Mono, weights 400 and 500
- Page title 32px/700, card title 17 to 20px/600, body 15px, small 12.5 to 13.5px
- Tags and eyebrows: Plex Mono 11px, uppercase, letter-spacing about 0.07em

Shape
- Cards: white, 1px line border, 10px radius, no heavy shadows
- Buttons and inputs: minimum height 44px, 6px radius, 1.5 to 2px border
- Every interactive element has a visible focus ring (3px `#3DA5E0`, 2px offset)

### Step 2. Provenance tags (a core product idea)

Every number or statement shows where it came from using a small tag:

| Tag | Meaning | Style |
|---|---|---|
| Database | Read from the hospital database | Navy fill, white text |
| Public evidence | From an outside source (news, health agency) | Blue tint |
| Scenario assumption | An assumed value, not measured | Amber |
| Manual input | Typed by the user | Violet |
| Model output | Calculated by AiGIS | Grey-blue |
| Synthetic data | Invented for the demo | Dashed outline |

### Step 3. Honesty rules

- Never invent real-world facts. Where a real outside reading is needed and no source is connected, show a visible placeholder such as `[SOURCE]`, `[ILI RATE]`, `[TREND]`. Do not replace placeholders with made-up numbers.
- Anything illustrative must carry the Synthetic data tag or a "Mockup · sample data" label.
- Show uncertainty: forecasts have a P10 to P90 band, and models report confidence.
- A warning is a lead for a person to check, not a finding of fault. Fraud-style flags must say so.

### Step 4. App shell (used by every page)

- Left sidebar, collapsible. Collapsed it is a 64px icon rail showing the shield mark from the logo (cropped from `aigis-logo.png`) above a menu button. Expanded it is 248px wide with the full logo. When expanded it **overlays** the page with a high z-index and a shadow, so the page content never changes width. The page content always keeps a 64px left margin.
- Nav items in order: Dashboard, Inventory, Predictions, Warnings, Insights, Settings. The Warnings item carries a red numbered badge with the count of open warnings. In the collapsed rail the badge sits on the icon's top right corner. The current page is highlighted navy with white text and `aria-current="page"`.
- Footer of the expanded sidebar: a "Mockup · sample data" tag (remove when real data is connected) and a "Last sync N min ago" link to Predictions.
- Top bar: facility name and type on the left, a bell button with the same red count badge on the right. The Dashboard has a facility `select`; other pages show the current facility as text.
- Page width: content is centred with a maximum width of 1240 to 1360px, 32px side padding.

### Step 5. Data model

Use the existing database schema; do not invent columns. The tables the app reads are: `facilities`, `suppliers`, `items`, `haze_api_weekly`, `weekly_inventory`, `purchase_orders`, `batches`. Before writing queries, read their real column names and confirm them. In outline:

- `items`: item name, category, unit, critical flag, reorder level, primary supplier
- `weekly_inventory`: per facility, item and week: closing stock, quantity received, quantity issued
- `haze_api_weekly`: per facility and week: haze API reading
- `purchase_orders`: item, supplier, quantity, order date, due date, status
- `batches`: lot number, quantity, expiry date, item, facility
- `suppliers`: name, contact, lead time
- `facilities`: name, ownership, size, district, state

If a field the design needs does not exist (for example supplier contact details or prediction run logs), list it as a gap and propose the smallest schema change. Do not silently make it up.

### Step 6. How to work

1. Report the Step 0 findings.
2. Build the shared shell (sidebar, top bar, tokens, tag component, card, button, input) as reusable components.
3. Build one page at a time from the page prompts below. After each page, run the app, check it at 1440px and 1024px wide, and list anything that differs from the reference HTML.
4. Keep mock data behind a single data layer (one module per page) so it can be swapped for real API calls.
5. Add keyboard support and visible labels: every input has a label, every icon-only button has an accessible name, charts have a text summary.
6. Do not add features beyond these prompts. If something is unclear, ask.

---

## PART 2. Page prompts (paste one at a time)

### Page 1. Dashboard (`dashboard.html`)

Build the Dashboard route.

Purpose: tell the pharmacy officer in one glance what needs attention at the selected facility and what is changing outside.

Layout, top to bottom:
1. Page title and one-line subtitle.
2. **Four KPI cards** in an auto-fit grid (min 230px). Each has an eyebrow label, a provenance tag, a large mono number and a one-line explanation:
   - Haze API (latest weekly reading, with its category: Good up to 50, Moderate up to 100, Unhealthy up to 200, Very unhealthy up to 300, Hazardous above)
   - Open warnings (count, and how many are high)
   - Lowest cover on a critical item (weeks, and the item name)
   - Open purchase orders (count, how many delayed, next due)
3. **Stock chart card** (wide) and **External signals card** (narrow, about 300 to 380px) side by side, wrapping on narrow screens.
   - Chart: weekly closing stock for one chosen item over the history, then a 4-week forecast. Show the forecast line, a P10 to P90 band, a red dashed reorder-level line, triangles for receipts (hollow triangle for an expected receipt), and a small bar strip underneath showing the weekly haze API (bars coloured by category). Footnote states how the forecast was made.
   - External signals: haze (from the database), COVID-19 activity and influenza-like illness (placeholders until sources are connected). Each row has a name, a mono value, a one-line trend note and a provenance tag. Link: "See how these feed predictions" to Predictions.
4. **Top warnings** (three most severe, severity pill, title, detail, link "View all N") and **Recent prediction runs** (three latest runs with time, trigger and status, link "All runs") side by side.

Behaviour:
- Facility `select` in the top bar changes every card. A facility with no stock data shows an empty state ("No stock rows for this facility") instead of a chart, and dashes in the KPIs.
- Warnings link to `/warnings`; runs link to `/predictions`.

Data: `haze_api_weekly`, `weekly_inventory`, `items`, `purchase_orders`, warnings and prediction runs (see Warnings and Predictions pages).

Acceptance: the chart has a text alternative; the forecast and band are visually distinct from history; the severity pill never relies on colour alone (it has text).

### Page 2. Inventory (`inventory.html`)

Build the Inventory route with two sub-tabs: **Inventory and purchase orders** and **Suppliers**. Tabs use `role="tablist"`.

Common behaviours on both tabs:
- Create, edit and delete rows. Add and Edit open an inline panel at the top of the page (title "Add item", "Edit purchase order" and so on) with a Manual input tag. Delete asks for confirmation in a banner ("Delete X? This removes the row from the database.") with Cancel and Delete.
- After a save, show a dismissible status banner: "Saved. New input triggers a sync, so external sources and predictions refresh now." This is how the "sync on new input" rule is communicated.
- **Unusual-input check** inside the form: before saving show an amber "Check this" notice when a value looks wrong, for example a reorder level five or more times the saved value, a purchase order quantity above 26 weeks of usual issue ("Check for an extra zero"), or a due date before the order date. The notice does not block saving. In production, back this with the Insights anomaly logic (and optionally an AI check).

Tab 1, Inventory and purchase orders:
- **Items table**: item name with category and unit underneath, class tag (Critical or Standard), on-hand, cover in weeks (red under 1, amber under 2), reorder level, primary supplier, Edit and Delete buttons. Search box filters by name. "Add item" button. Footnote explains on-hand is the latest closing stock and cover is on-hand divided by mean weekly issue over the last 6 weeks.
- **Purchase orders table** under it: PO number, item, supplier, quantity, ordered, due, status tag (Open, Due today, Delayed with "N days late", Received, Cancelled) and a note such as "Due in 6 days", row actions. "Add purchase order" button. Note: orders in the database count as incoming stock in every forecast.

Tab 2, Suppliers:
- Table: name and email, contact person and phone, lead time, items supplied, open POs, risk tag with a short note. Risk rules: Late delivery (an open order is overdue), Concentration (two or more critical items with one supplier), Single source (one critical item, no backup), Low otherwise. CRUD like items.

Data: `items`, `weekly_inventory`, `purchase_orders`, `suppliers`, `batches` (for expiry). Item and PO forms use Zod schemas; the supplier `select` in item and PO forms lists suppliers from the database.

Acceptance: table scrolls horizontally on narrow widths without breaking the page; edit and delete never lose the search text; all actions work by keyboard.

### Page 3. Predictions (`predictions.html`)

Build the Predictions route. It is the run log plus the explanation of what the models found.

Layout, top to bottom:
1. **Last sync card**: time of the last run, "N min ago", the trigger (hourly, new input or manual), next scheduled time, and a **Sync now** button ("Use when you see news before the next hourly run"). Pressing it adds a Manual run at the top and selects it.
2. **Previous runs**: show only the **5 most recent runs** as selectable tiles (time, status tag, trigger, risk score). Show the total "N today" beside the heading and a **View all N runs** button that opens a modal listing every run (time, trigger, status, risk score, warnings, Open button). Opening a run from the modal selects it and closes the modal.
3. **Run detail card** for the selected run, with a Chat and Graph toggle (Graph is the default).
   - **Left panel** (about 280px), modelled on a verdict page: the prediction claim ("Ipratropium 0.5mg nebule will run out within 7 days"), a consensus tag ("Consensus · 3 of 3 models agree"), run time, **Sealed 3/3** and **Revealed N/3** counters (each model's answer is sealed before any are revealed, so they cannot copy each other), a **Risk score** out of 100 (mean of the three model confidences) with a run ID, a **Replay** control (Play or Pause, a scrubber, and 1X, 5X, 10X, 30X speed buttons) and a "What to do" box.
   - **Graph view**: a central Consensus node linked to three model nodes (Demand model, External signal model, Supply model). Each model has a vote box (YES 86%) between it and the centre, and five small step nodes around it (search icon or page icon) with short labels. Click a model or a step to fill the right-hand panel: model name and version, Outcome, Confidence, a Research feed (the five steps, clickable), and a Step detail card (what it looked at, what it found, and a provenance tag). Replay reveals steps round-robin, then votes, then the Consensus node.
   - **Chat view**: three model cards (name, role such as Investigator, Source, Skeptic, vote and confidence, Show or Hide trail). The selected model expands to its research trail, a confidence bar, its reasoning, a Supports line, an Insufficient line and source chips.
4. **Sources read** (each source with provenance tag and Read, Failed or Stale status) and **What changed since the previous run** (typed rows: No change, Input, Raised, Cleared, Stale).
5. **Suggested stock for next month**: a table with Internal, External effect, External, Combined and Order by columns for each item, and a **Trust in external signals** slider (0 to 100 percent). Combined equals internal times one plus the external effect times the trust level. Footnote labels External effects as scenario assumptions until measured from a real source.

Behaviour notes:
- A run with a failed source is marked Partial, reuses the last good value, flags it Stale, and lowers that model's confidence. Say so in the step detail.
- Pausing, scrubbing and changing speed must work during replay.

Data: a `prediction_runs` store (run time, trigger, status, duration, per-model outputs, steps, sources, changes). This table probably does not exist yet: propose its schema. Models return structured steps so the UI can render them; the three models can be real model calls, a rules engine, or mocks at first.

Acceptance: five run tiles only on the page; the modal shows all runs; every graph node is reachable by keyboard and has an accessible name; replay does not re-trigger network calls.

### Page 4. Warnings (`warnings.html`)

Build the Warnings route: the work queue.

Layout:
1. Title, subtitle "N to resolve. Restock what is running out, manage what is at risk."
2. Filter chips with counts: All, Restock, Manage, Check input. Chips use `aria-pressed`.
3. A list of warning cards. Each card has a coloured left bar by severity (High red, Medium amber, Low light blue) and contains: severity tag, kind tag, provenance tag, title, detail, an **AI check** line (what the reviewing agents concluded and where they disagreed), a **Suggested action**, and two buttons: **Mark resolved** and **Snooze** (24 hours).
4. A "Resolved or snoozed N" panel at the bottom with a **Reopen all** button.

Behaviour:
- Resolving or snoozing removes the card and lowers the count everywhere it appears: the sidebar badge, the bell in the top bar, the page subtitle and the chip counts.
- Empty state: "Nothing to resolve in this view."
- Sort by severity, then by how soon the problem bites.

Warning types to support: low cover versus reorder level, late purchase order, batch near expiry, supplier concentration, unusual manual input (possible typo), rising outside signal affecting an item.

Data: warnings are produced by the prediction run. Persist resolved and snoozed state per user, with the time snoozed until.

Acceptance: count stays in sync across the whole app; each action has a visible result and can be undone from the resolved panel.

### Page 5. Insights (`insights.html`)

Build the Insights route: an analytics page where AI looks across the database for patterns, including ones that look wrong or concerning.

Layout, top to bottom:
1. Title and a **Run analysis** button with "Last analysed HH:MM today".
2. **Four key figures**: series scanned, concerning flags, haze-to-demand correlation, share of receipts matched to orders. Each with a provenance tag.
3. **Four analysis charts** in a responsive 2 by 2 grid. Each card has a question as its title, a short caption, the chart, a bold one-line takeaway with a sentence of explanation, and provenance tags:
   - *Does haze drive demand?* Scatter of weekly haze API against weekly units issued, with a fitted line, and the correlation r in the takeaway.
   - *Are any weeks unusual?* Weekly issue line with the mean and a two standard deviation band; points outside the band are flagged.
   - *Do receipts match orders?* Weekly received units as bars; receipts with no linked purchase order are amber.
   - *Which items are closest to running out?* Horizontal bars of weeks of cover per item, a dashed two-week threshold line, bars coloured red under 1 week, amber under 2.
4. **Relationship graph**: suppliers on the left, items in the middle, flagged problems on the right. Links are coloured by concern (red high, amber worth a look, grey normal). The graph step links suppliers, items, orders and batches so the AI can reason across tables. Use a graph library if the repo has one or one is approved; otherwise a fixed layout is fine.
5. **Findings list**: filter chips (All, Concerning, Patterns, Data quality). Each finding is a card with kind tag, provenance tag, confidence (low, medium, high), title, explanation, an Evidence box and a Suggested next step box. Examples to support: receipts with no purchase order, an outlier that looks like a typing error, concentration of critical items on one supplier, a recurring stock dip before each delivery, a weak haze effect, and stock history that ends months before the orders and batches.

Rules:
- Fraud-style flags are leads for a person to check. Never state or imply wrongdoing. Show the evidence and the confidence.
- Statistics are computed on the server or in a shared utility, not hard-coded: Pearson correlation, mean and standard deviation (or median absolute deviation) for outliers, join checks for unmatched receipts.
- Charts must have text summaries.

Data: `weekly_inventory`, `haze_api_weekly`, `purchase_orders`, `items`, `suppliers`, `batches`. Findings are stored so they can be reviewed, dismissed and tracked.

Acceptance: every chart derives from query results, not constants; each finding links to the rows it came from.

### Page 6. Settings (`settings.html`)

Build the Settings route. **This is a UI-only mockup: no backend, nothing connects.** Keep the label "Design only, nothing connects" visible.

Sections, top to bottom:
1. **Database connection**: type select (PostgreSQL, MySQL, SQL Server, SQLite, CSV or SQL file upload), host, port (auto-fills per type), database name, read-only user, password (never stored), and a **Test connection** button. With details missing it shows "Missing details"; with host, database and user filled it shows a pretend "Reachable" result and says nothing was contacted.
2. **Map tables**: a table with one row per AiGIS table (`facilities`, `suppliers`, `items`, `haze_api_weekly`, `weekly_inventory`, `purchase_orders`, `batches`), a source-table `select`, row count, what it is used for, and a status tag (Matched, Remapped, Not mapped).
3. **Migration**: a **Run dry run** button that steps through Read schema, Check keys, Check dates, Find gaps and Report, with a result for each, and a **Reset** button. Beside it a Migration history list.
4. **Sync and sources**: toggles (switches with `role="switch"`) for scheduled sync, sync when saving new input, COVID-19 activity, influenza-like illness and the AI check for unusual input; a scheduled-sync frequency select (every 15 minutes, hourly, every 6 hours, daily); an alert sensitivity slider from Very low to Very high with the note that higher means more warnings, including some that turn out to be nothing.

Acceptance: nothing is sent anywhere; the password field is never persisted; every control is keyboard operable.

---

## Final checks (ask the agent to run these at the end)

- List every library used and say whether it already existed in `package.json` or was added with approval.
- Confirm the sidebar never changes the width of the page content.
- Confirm the warnings count is identical in the sidebar badge, the bell, and the Warnings page.
- Confirm no real-world statistic appears without a source or a placeholder.
- Confirm all interactive targets are at least 44px tall and have visible focus.
