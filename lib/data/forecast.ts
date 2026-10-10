export type ForecastPoint = {
  weekStart: string;
  forecast: number;
  p10: number;
  p90: number;
};

// Model output: a simple trend + spread projection from the trailing weeks of
// closing stock. Not a trained model; illustrative for the demo. See the
// chart footnote this feeds for the honest description shown to the user.
export function forecastClosingStock(
  history: { weekStart: string; closingStock: number }[],
  weeksAhead: number,
  trailingWeeks = 8,
): ForecastPoint[] {
  const trail = history.slice(-trailingWeeks);
  const deltas: number[] = [];
  for (let i = 1; i < trail.length; i++) {
    deltas.push(trail[i].closingStock - trail[i - 1].closingStock);
  }
  const meanDelta = deltas.length
    ? deltas.reduce((a, b) => a + b, 0) / deltas.length
    : 0;
  const variance = deltas.length
    ? deltas.reduce((a, b) => a + (b - meanDelta) ** 2, 0) / deltas.length
    : 0;
  const stdDev = Math.sqrt(variance);

  const lastWeek = history[history.length - 1];
  const lastDate = new Date(`${lastWeek.weekStart}T00:00:00Z`);
  const points: ForecastPoint[] = [];

  for (let k = 1; k <= weeksAhead; k++) {
    const date = new Date(lastDate);
    date.setUTCDate(date.getUTCDate() + 7 * k);
    const level = Math.max(0, lastWeek.closingStock + meanDelta * k);
    const spread = stdDev * Math.sqrt(k) * 1.2;
    points.push({
      weekStart: date.toISOString().slice(0, 10),
      forecast: Math.round(level),
      p10: Math.round(Math.max(0, level - spread)),
      p90: Math.round(level + spread),
    });
  }

  return points;
}
