# Demand Forecasting Method: Holt + 4-Week WMA

Oct 10, 2026

## Overview

Next week's demand for each facility and item is the average of two simple forecasts, Holt's linear trend and a 4-week weighted moving average, and that average then drives the order quantity. Both methods need only the weekly demand series, so they run on the 5 rows you have today and on any public dataset normalized into `weekly_inventory`.

- **Inputs:** `weekly_inventory` (issued, unmet demand, closing stock), `purchase_orders` (lead time, fill rate), `items` (criticality, shelf life).
- **Output per facility and item:** forecast demand per week, safety stock, and order quantity.
- **Left out for now:** the haze regression. It needs about 20 weeks of history and can be added later as a third method.
- **Minimum history:** under 4 weeks, use the plain mean of the weeks available. From 4 weeks, use both methods.
- **Limit:** item 1 has 5 weeks, so every parameter below is a starting default, not a fitted value.

## Demand series

Weekly demand is `issued_qty + unmet_demand_qty`, one value per facility, item and week. Issued quantity alone understates demand in any stockout week, because the shelf was empty and the missing sales were never recorded.

```sql
create or replace view weekly_demand as
select facility_id,
       item_id,
       week_start::date as week_start,
       issued_qty + coalesce(unmet_demand_qty, 0) as demand_qty
from public.weekly_inventory;
```

- **Dates:** `week_start` is stored as text, so cast it to `date` and sort ascending before any calculation.
- **Wastage:** excluded from demand. Forecast it separately as a share of `opening_stock`.
- **Missing weeks:** if 1 or 2 weeks in a row are absent, fill them by linear interpolation. If more are absent, restart the series after the gap.
- **No unmet-demand column** (typical of public data): use issued or sold quantity as demand and note the series may be understated.

## Method A: Holt's linear trend

Holt keeps two running numbers, a smoothed level and a smoothed weekly trend, and projects the next week as level plus trend. It follows a rising or falling series, which is why it suits item 1 (issued 55, 69, 75 in the last three weeks).

```latex
L_t = \alpha\, y_t + (1-\alpha)(L_{t-1} + T_{t-1})

T_t = \beta\,(L_t - L_{t-1}) + (1-\beta)\, T_{t-1}

F_{t+1} = L_t + T_t
```

- **Start-up:** set `L` to week 2's demand and `T` to week 2 minus week 1, then update from week 3.
- **Defaults:** α = 0.4 (level), β = 0.2 (trend). Once an item has 12 or more weeks, pick α from 0.1 to 0.9 and β from 0.05 to 0.5 by lowest mean absolute error on rolling one-week-ahead forecasts.
- **Floor:** the forecast is never below 0.
- **Horizon:** use the 1-week-ahead forecast and hold it flat over the cover period. Extending the trend over 4 weeks overstates demand when the trend is noise.

Worked example, item 1 at facility 1, with α = 0.4 and β = 0.2:

| Week | Demand (y) | Level (L) | Trend (T) | Forecast for this week |
| --- | --- | --- | --- | --- |
| 1 | 56 | | | |
| 2 | 63 | 63.00 | 7.00 | |
| 3 | 55 | 64.00 | 5.80 | 70.0 |
| 4 | 69 | 69.48 | 5.74 | 69.8 |
| 5 | 75 | 75.13 | 5.72 | 75.2 |
| 6 | forecast | | | 80.8 |

Holt's week 6 forecast is 80.8, above anything seen so far, because the trend term is still about 5.7 a week. It is the aggressive half of the pair.

## Method B: 4-week weighted moving average

The weighted moving average takes the last 4 weeks of demand and counts the newest week 4 times and the oldest once. It reacts to change quickly but never forecasts beyond the range of recent weeks, so it is the steady half of the pair.

```latex
F_{t+1} = \frac{4\,y_t + 3\,y_{t-1} + 2\,y_{t-2} + 1\,y_{t-3}}{10}
```

Worked example, item 1, forecasting week 6 from weeks 2 to 5 (63, 55, 69, 75):

```latex
F_6 = \frac{4(75) + 3(69) + 2(55) + 1(63)}{10} = \frac{680}{10} = 68.0
```

For comparison, a plain 4-week mean gives 65.5. The weights pull the forecast toward the latest weeks, which is why 68.0 sits higher.

## Combining and ordering

The forecast demand `d` is the simple average of the two methods: (80.8 + 68.0) / 2 = 74.4 units for week 6 of item 1. The average is an estimate of typical demand, not a safe order quantity, so safety stock goes on top.

```latex
d = \frac{F_{Holt} + F_{WMA}}{2}

SS = z\,\sigma\,\sqrt{R + L}

S = d\,(R + L) + SS

\text{order qty} = \frac{S - \text{on hand} - \text{on order}}{\text{fill rate}}
```

| Symbol | Meaning | Item 1 value | Source |
| --- | --- | --- | --- |
| R | Review period, weeks | 3 | POs placed every 20 to 21 days |
| L | Lead time, weeks | 0.8 | Order to receipt took 4, 5, 6, 6, 7 days, mean 5.6 |
| σ | Std dev of weekly demand | 8.5 | Issued 56, 63, 55, 69, 75 |
| z | Service level factor | 2.05 | 98% service, since `is_critical` = 1. Use 1.65 (95%) for other items |
| Fill rate | Received / ordered | 0.983 | Mean of the 5 POs |
| On hand | Closing stock, week 5 | 91 | `weekly_inventory` |
| On order | Open POs | 0 | Assumed, none are open in the sample |

Worked example for item 1: SS = 2.05 × 8.5 × √3.8 = 34. S = 74.4 × 3.8 + 34 = 317. Order qty = (317 − 91 − 0) / 0.983 = **230 inhalers**. Past POs were 182 to 219 units, so 230 is in range for a week with rising demand.

Two rules change as history grows:

- **Sigma:** with 8 or more weeks of forecast errors, replace the raw demand std dev with the std dev of the combined forecast's errors.
- **Weights:** with 8 or more weeks of errors, weight each method by 1 / MAE instead of 50/50, capped at 25% to 75% so neither is switched off.

Reference implementation (Python):

```python
import numpy as np
import pandas as pd

def holt(y, alpha=0.4, beta=0.2):
    L, T = y[1], y[1] - y[0]
    for v in y[2:]:
        L_prev = L
        L = alpha * v + (1 - alpha) * (L + T)
        T = beta * (L - L_prev) + (1 - beta) * T
    return max(L + T, 0.0)

def wma4(y, w=(1, 2, 3, 4)):
    last = list(y)[-4:]
    return sum(a * b for a, b in zip(last, w)) / sum(w)

def forecast(y):
    y = [float(v) for v in y if pd.notna(v)]
    if len(y) < 4:
        return float(np.mean(y)) if y else 0.0
    return (holt(y) + wma4(y)) / 2

def order_qty(d, sigma, lead_wk, review_wk, on_hand, on_order, fill, z):
    cover = review_wk + lead_wk
    ss = z * sigma * np.sqrt(cover)
    target = d * cover + ss
    return max(0.0, (target - on_hand - on_order) / fill)

# df = pd.read_sql("select * from weekly_demand order by week_start", conn)
# fc = df.groupby(["facility_id", "item_id"])["demand_qty"].apply(forecast)
```

## Saving the forecasts

Each weekly run stores the Holt, WMA and averaged forecasts in `demand_forecasts`, and the actual demand is filled in once the week closes. That lets each method be scored on its own record, which the error-based weighting above needs.

```sql
create table public.demand_forecasts (
  forecast_id bigint generated always as identity primary key,
  facility_id bigint not null references facilities (facility_id),
  item_id bigint not null references items (item_id),
  made_on date not null,              -- when the forecast was run
  target_week_start date not null,    -- the week being forecast
  history_weeks integer,              -- weeks of data used
  alpha double precision,             -- Holt parameters used
  beta double precision,
  holt_qty double precision,
  wma_qty double precision,
  avg_qty double precision,           -- the number the ordering formula uses
  actual_qty bigint,                  -- filled in once the week closes
  unique (facility_id, item_id, target_week_start, made_on)
);
```

- **One row** per facility, item, target week and run date. The unique key makes a rerun on the same day harmless.
- **Short history:** with fewer than 4 weeks, `holt_qty` and `wma_qty` stay null and `avg_qty` holds the plain mean.
- **Reproducible:** `history_weeks`, `alpha` and `beta` are stored so any past forecast can be recomputed.
- **New columns for new methods:** the table has one column per method. If you add the haze regression later, add a column, or move to one row per method.

Run this every week, after the new `weekly_inventory` rows are loaded. Do step 1 before step 2.

1. Fill in the actuals for forecasts whose week has closed:

```sql
update demand_forecasts f
set actual_qty = d.demand_qty
from weekly_demand d
where d.facility_id = f.facility_id
  and d.item_id = f.item_id
  and d.week_start = f.target_week_start
  and f.actual_qty is null;
```

2. Write the new forecasts (`df` holds the rows of the `weekly_demand` view):

```python
from datetime import date, timedelta

def save_forecasts(conn, df, made_on=None, alpha=0.4, beta=0.2):
    made_on = made_on or date.today()
    rows = []
    for (fac, item), g in df.sort_values("week_start").groupby(["facility_id", "item_id"]):
        y = [float(v) for v in g["demand_qty"]]
        if len(y) < 4:
            h = w = None
            a = sum(y) / len(y)
        else:
            h, w = holt(y, alpha, beta), wma4(y)
            a = (h + w) / 2
        target = g["week_start"].iloc[-1] + timedelta(days=7)
        rows.append((int(fac), int(item), made_on, target, len(y), alpha, beta, h, w, a))
    with conn.cursor() as cur:
        cur.executemany(
            """insert into demand_forecasts
               (facility_id, item_id, made_on, target_week_start, history_weeks,
                alpha, beta, holt_qty, wma_qty, avg_qty)
               values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               on conflict (facility_id, item_id, target_week_start, made_on) do nothing""",
            rows)
    conn.commit()
```

3. Check which method is winning. Once an item has 8 or more scored weeks, feed `holt_mae` and `wma_mae` into the 1 / MAE weights from the section above.

```sql
create view forecast_accuracy as
select item_id,
       count(*) as weeks_scored,
       avg(abs(holt_qty - actual_qty)) as holt_mae,
       avg(abs(wma_qty - actual_qty)) as wma_mae,
       avg(abs(avg_qty - actual_qty)) as avg_mae
from demand_forecasts
where actual_qty is not null
group by item_id;
```

## Sample dataset 1: Pharma Sales Data (Kaggle)

This is the quickest test: six years of sales for 8 drug groups, including R03 (the ATC code for asthma and COPD drugs), the same therapeutic area as your inhalers and nebules. Every column maps to `issued_qty` once the daily rows are summed into weeks.

What the sources confirm:

- **Source and span:** [Pharma Sales Data on Kaggle](https://www.kaggle.com/datasets/milanzdravkovic/pharma-sales-data) covers 2014 to 2019 across 8 ATC categories.
- **Granularity:** the [Towards Data Science walkthrough](https://towardsdatascience.com/analysing-pharmaceutical-sales-data-in-python-6ce74da818ab) uses a daily and a monthly file and mentions no weekly file, so build weeks from the daily file.
- **Gaps:** the last recorded day is 8 October 2019, so drop that incomplete week. Some groups have days with zero sales.
- **Not confirmed:** column names, the sales unit and the licence. Check the file header and the licence box on the Kaggle page before use. The code below assumes the first column is the date and the other columns are ATC codes.

| Public field | Your column | Rule |
| --- | --- | --- |
| Date (daily file) | `week_start` | Monday of that week, as text `YYYY-MM-DD` |
| ATC group column, e.g. R03 | `item_id` | One `items` row per ATC column. `item_name` = the ATC code, `category` = Medication |
| Sales volume, summed per week | `issued_qty` | Rounded to whole units |
| None | `facility_id` | One synthetic facility, value 1 |
| None | `unmet_demand_qty`, `wastage_qty` | 0, because the data records neither |
| None | `haze_api_avg` | Null. Neither method uses it |
| None | `opening_stock`, `received_qty`, `closing_stock`, `reorder_level`, `weeks_of_cover`, `stockout_flag` | Left empty, or simulated as described below |

```python
import pandas as pd

df = pd.read_csv("salesdaily.csv")        # check the real header first
date_col = df.columns[0]                   # assumed: first column is the date
atc_cols = ["R03"]                         # add more ATC columns to test more items

df[date_col] = pd.to_datetime(df[date_col])
df["week_start"] = df[date_col] - pd.to_timedelta(df[date_col].dt.weekday, unit="D")

# keep only complete weeks (7 daily rows)
days = df.groupby("week_start")[date_col].count()
df = df[df["week_start"].isin(days[days == 7].index)]

weekly = (df.groupby("week_start")[atc_cols].sum().reset_index()
            .melt(id_vars="week_start", var_name="atc", value_name="issued_qty"))

item_ids = {a: i + 1 for i, a in enumerate(atc_cols)}   # matching rows go into items
out = pd.DataFrame({
    "facility_id": 1,
    "item_id": weekly["atc"].map(item_ids),
    "week_start": weekly["week_start"].dt.strftime("%Y-%m-%d"),
    "issued_qty": weekly["issued_qty"].round().astype("int64"),
    "unmet_demand_qty": 0,
    "wastage_qty": 0,
})
out.insert(0, "record_id", range(1, len(out) + 1))
```

To test ordering as well as forecasting, replay the policy: treat the sales series as true demand, issue the smaller of demand and stock on hand, record the shortfall as `unmet_demand_qty`, and receive each order one lead time after it is placed, sized with `order_qty()` from the Combining and ordering section. For forecast accuracy alone, skip the simulation.

## Sample dataset 2: NHS English Prescribing Data (EPD)

EPD has your exact drugs (salbutamol, ipratropium, budesonide) at practice level, so each practice stands in for a facility. Its catch is granularity: it is monthly, so the months must be spread into weeks before the weekly methods can run.

What the sources confirm:

- **Coverage and cadence:** per the [NHSBSA EPD page](https://www.nhsbsa.nhs.uk/prescription-data/prescribing-data/english-prescribing-data-epd), data is available from January 2014 and updated monthly. It covers prescriptions issued in England and dispensed in England, Wales, Scotland and the Crown Dependencies.
- **Licence:** the [NHSBSA Open Data Portal page](https://opendata.nhsbsa.net/dataset/english-prescribing-data-epd) lists the Open Government Licence 3.0.
- **Not confirmed:** the column names below come from memory, because the portal's data API could not be read automatically. Check them against the dataset guidance document before coding. The BNF codes also need a check in the BNF.

| EPD field | Your column | Rule |
| --- | --- | --- |
| `PRACTICE_CODE` | `facility_id` | One integer per practice, kept in a lookup table |
| `BNF_CODE` (first 9 characters = chemical substance) | `item_id` | One `items` row per chemical substance. Salbutamol 0301011R0, ipratropium 0301020I0, budesonide 0302000C0 |
| `YEAR_MONTH` | `week_start` | Spread each month evenly over its days, then sum into Monday-start weeks |
| `TOTAL_QUANTITY` | `issued_qty` | Weekly share of the month, rounded. If the unit is doses rather than inhalers, use `ITEMS` instead |
| `ACTUAL_COST` / `TOTAL_QUANTITY` | `items.unit_cost_myr` | Multiply by a fixed GBP to MYR rate and record the rate you used |
| None | `unmet_demand_qty`, `wastage_qty`, `haze_api_avg` | 0, 0, null |

```python
import pandas as pd

keep = ("0301011R0", "0301020I0", "0302000C0")   # confirm in the BNF
cols = ["YEAR_MONTH", "PRACTICE_CODE", "BNF_CODE", "TOTAL_QUANTITY", "ACTUAL_COST"]  # confirm names

frames = []
for path in monthly_files:                       # one CSV per month
    chunk = pd.read_csv(path, usecols=cols, dtype={"BNF_CODE": str})
    frames.append(chunk[chunk["BNF_CODE"].str[:9].isin(keep)])
epd = pd.concat(frames)

monthly = (epd.groupby(["PRACTICE_CODE", "BNF_CODE", "YEAR_MONTH"], as_index=False)
              .agg(qty=("TOTAL_QUANTITY", "sum"), cost=("ACTUAL_COST", "sum")))

def to_daily(r):
    p = pd.Period(str(r.YEAR_MONTH), "M")
    days = pd.date_range(p.start_time, p.end_time.normalize(), freq="D")
    return pd.DataFrame({"PRACTICE_CODE": r.PRACTICE_CODE, "BNF_CODE": r.BNF_CODE,
                         "date": days, "qty": r.qty / len(days)})

daily = pd.concat(to_daily(r) for r in monthly.itertuples())
daily["week_start"] = daily["date"] - pd.to_timedelta(daily["date"].dt.weekday, unit="D")
weekly = (daily.groupby(["PRACTICE_CODE", "BNF_CODE", "week_start"], as_index=False)["qty"].sum())
weekly["issued_qty"] = weekly["qty"].round().astype("int64")
# drop the first and last week of the range, which are partial
```

Three practical rules:

- **Pick high-volume practices.** A single drug at a small practice has many zero months, which neither method handles well. Take 10 to 20 practices with at least 24 months of nonzero quantity.
- **Expect flattering errors.** Spreading a month evenly removes real week-to-week noise, so backtest errors on this data will be lower than on your own weekly data.
- **Or stay monthly.** Both methods work on any fixed period. Keep the monthly rows, store the first day of the month in `week_start`, and express R and L in months.

## Backtest and next steps

Adopt the averaged forecast only if it beats a naive "same as last week" forecast on most series. The test is rolling and one week ahead, so every forecast uses only weeks that came before it.

1. For each facility and item, start at week 8. For each later week `t`, forecast week `t + 1` from weeks up to `t`.
2. Record the actual, the Holt forecast, the WMA forecast, the average of the two, and the naive forecast (last week's demand).
3. Score each with MAE and MASE. MASE is a method's MAE divided by the naive MAE, so below 1 means better than naive.
4. If you tune α and β, tune on the first 70% of weeks and score on the last 30%.

```python
def backtest(y, start=8):
    rows = []
    for t in range(start, len(y)):
        hist, actual = y[:t], y[t]
        rows.append(dict(actual=actual, holt=holt(hist), wma=wma4(hist),
                         combined=forecast(hist), naive=hist[-1]))
    return pd.DataFrame(rows)

def mase(df, col):
    return (df[col] - df["actual"]).abs().mean() / (df["naive"] - df["actual"]).abs().mean()
```

Next steps, in order:

- Run the backtest on both public datasets first, since they have years of weeks.
- Switch to your own `weekly_inventory` as weeks accumulate: tune α and β at 12 weeks, move to error-based sigma and weights at 8 weeks of forecast errors.
- Add the haze regression as a third method at about 20 weeks.
- Open question: where do open purchase orders ("on order") come from? The order formula needs them, and the sample has none.

## Sources

- [Pharma Sales Data, Kaggle](https://www.kaggle.com/datasets/milanzdravkovic/pharma-sales-data)
- [Analysing Pharmaceutical Sales Data in Python, Towards Data Science](https://towardsdatascience.com/analysing-pharmaceutical-sales-data-in-python-6ce74da818ab)
- [English Prescribing Dataset (EPD), NHSBSA Open Data Portal](https://opendata.nhsbsa.net/dataset/english-prescribing-data-epd)
- [English Prescribing Data (EPD), NHSBSA](https://www.nhsbsa.nhs.uk/prescription-data/prescribing-data/english-prescribing-data-epd)
