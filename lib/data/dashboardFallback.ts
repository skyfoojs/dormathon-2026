import type { Item } from "@/lib/db/types";
import type { ExpectedVsActualPoint, ProductAccuracy } from "@/lib/data/dashboardReports";

// Hand-picked sample data for the Prediction accuracy KPI and the expected
// vs actual card, shown only while no stored forecast has real recorded
// usage to score against (public.demand_forecasts rows only get an actual
// once their day has passed and been entered). Every consumer shows a
// visible "Sample data" tag alongside it - never presented as real.

// Deterministic per-item pseudo-numbers (same item -> same values every
// load), not Math.random(), so the sample doesn't visibly reshuffle.
function seeded(itemId: number, spread: number, base: number): number {
  const x = Math.sin(itemId * 999.17) * 10000;
  return base + Math.abs(x - Math.floor(x)) * spread;
}

export function sampleProductAccuracy(items: Item[]): ProductAccuracy[] {
  return items.map((item) => {
    const accuracy = Math.min(98, seeded(item.item_id, 35, 62));
    const avgMissUnits = seeded(item.item_id + 1, 40, 5);
    const weeksScored = 12;
    const weeksWithin10Pct = Math.round((accuracy / 100) * weeksScored * 0.8);
    return {
      itemId: item.item_id,
      itemName: item.item_name,
      accuracy,
      avgMissUnits,
      weeksWithin10Pct,
      weeksScored,
    };
  });
}

export function sampleExpectedVsActual(itemId: number): ExpectedVsActualPoint[] {
  const points: ExpectedVsActualPoint[] = [];
  const today = new Date();
  today.setUTCDate(today.getUTCDate() - (today.getUTCDate() % 7)); // snap to a week boundary
  const weekStart = (weeksAgo: number) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
    return d.toISOString().slice(0, 10);
  };
  const baseline = 80 + (itemId % 5) * 20;
  for (let i = 10; i >= 1; i--) {
    const actual = Math.round(baseline + seeded(itemId + i, 30, -15));
    const expected = Math.round(baseline + seeded(itemId + i + 50, 20, -10));
    points.push({ weekStart: weekStart(i), actual, expected });
  }
  const lastExpected = points[points.length - 1]?.expected ?? baseline;
  for (let k = 1; k <= 4; k++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + k * 7);
    points.push({ weekStart: d.toISOString().slice(0, 10), actual: null, expected: lastExpected });
  }
  return points;
}
