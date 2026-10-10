// Holt's linear trend + 4-week weighted moving average, combined by simple
// average. Ported directly from docs/Internal-Calculation.md's reference
// Python implementation; see that file for the derivation and defaults.

export function holt(y: number[], alpha = 0.4, beta = 0.2): number {
  let L = y[1];
  let T = y[1] - y[0];
  for (let i = 2; i < y.length; i++) {
    const v = y[i];
    const Lprev = L;
    L = alpha * v + (1 - alpha) * (L + T);
    T = beta * (L - Lprev) + (1 - beta) * T;
  }
  return Math.max(L + T, 0);
}

export function wma4(y: number[], w: [number, number, number, number] = [1, 2, 3, 4]): number {
  const last = y.slice(-4);
  const sumW = w.reduce((a, b) => a + b, 0);
  return last.reduce((sum, v, i) => sum + v * w[i], 0) / sumW;
}

export function mean(y: number[]): number {
  if (y.length === 0) return 0;
  return y.reduce((a, b) => a + b, 0) / y.length;
}

export function stdDev(y: number[]): number {
  if (y.length === 0) return 0;
  const m = mean(y);
  return Math.sqrt(mean(y.map((v) => (v - m) ** 2)));
}

export type CombinedForecast = { holtQty: number | null; wmaQty: number | null; avgQty: number };

// Forecasts the NEXT value after the given history.
export function forecastNext(y: number[], alpha = 0.4, beta = 0.2): CombinedForecast {
  if (y.length < 4) {
    return { holtQty: null, wmaQty: null, avgQty: mean(y) };
  }
  const h = holt(y, alpha, beta);
  const w = wma4(y);
  return { holtQty: h, wmaQty: w, avgQty: (h + w) / 2 };
}

export type OrderQtyInput = {
  demand: number;
  sigma: number;
  leadWeeks: number;
  reviewWeeks: number;
  onHand: number;
  onOrder: number;
  fillRate: number;
  z: number;
};

export function orderQty({ demand, sigma, leadWeeks, reviewWeeks, onHand, onOrder, fillRate, z }: OrderQtyInput): number {
  const cover = reviewWeeks + leadWeeks;
  const safetyStock = z * sigma * Math.sqrt(cover);
  const target = demand * cover + safetyStock;
  return Math.max(0, (target - onHand - onOrder) / fillRate);
}
