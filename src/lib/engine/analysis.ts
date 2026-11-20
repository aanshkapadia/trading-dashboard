import type { Bar } from "../types";
import type { SignalSeries, Suggestion } from "./signals";

// ---------- Forward returns after signals ----------

export interface ForwardStat {
  horizon: number;
  samples: number;
  avgPct: number | null;
  medianPct: number | null;
  pctPositive: number | null;
  /** Average forward return across ALL days, for comparison. */
  baselineAvgPct: number | null;
}

/**
 * "What happened after the signal": for every bar with the given suggestion, the return from the
 * next open to the close `h` bars later. Compared against the same horizon from every day.
 */
export function forwardReturns(
  bars: Bar[],
  s: SignalSeries,
  kind: Suggestion = "BUY",
  horizons = [5, 20, 60],
): ForwardStat[] {
  return horizons.map((h) => {
    const sig: number[] = [];
    const all: number[] = [];
    for (let i = 0; i + 1 + h < bars.length; i++) {
      const ret = (bars[i + 1 + h].close / bars[i + 1].open - 1) * 100;
      if (Number.isNaN(s.rsi[i])) continue;
      all.push(ret);
      // Only count the first bar of a run of consecutive signals so one event isn't counted 5 times.
      if (s.suggestion[i] === kind && s.suggestion[i - 1] !== kind) sig.push(ret);
    }
    return {
      horizon: h,
      samples: sig.length,
      avgPct: sig.length ? mean(sig) : null,
      medianPct: sig.length ? median(sig) : null,
      pctPositive: sig.length ? (sig.filter((x) => x > 0).length / sig.length) * 100 : null,
      baselineAvgPct: all.length ? mean(all) : null,
    };
  });
}

// ---------- Market move vs company-specific move ----------

export interface DropBreakdown {
  /** Stock's % change from its 1y high to now. */
  fromHighPct: number;
  highDate: string;
  /** Benchmark's % change over the same window. */
  benchmarkPct: number;
  beta: number;
  /** beta × benchmark move: what the market alone "explains". */
  expectedPct: number;
  /** Actual minus expected. Strongly negative = company-specific weakness. */
  excessPct: number;
  label: "Market-driven" | "Company-specific" | "Outperforming" | "Near high";
}

export function dropBreakdown(bars: Bar[], benchmark: Bar[], window = 252): DropBreakdown | null {
  if (bars.length < 60 || benchmark.length < 60) return null;
  const recent = bars.slice(-window);
  let hi = recent[0];
  for (const b of recent) if (b.close > hi.close) hi = b;
  const last = bars[bars.length - 1];
  const fromHighPct = (last.close / hi.close - 1) * 100;

  const bIdx = new Map(benchmark.map((b, i) => [b.date, i]));
  const bHi = bIdx.get(hi.date);
  const bLast = benchmark[benchmark.length - 1];
  if (bHi === undefined) return null;
  const benchmarkPct = (bLast.close / benchmark[bHi].close - 1) * 100;

  const beta = computeBeta(bars, benchmark, window);
  const expectedPct = beta * benchmarkPct;
  const excessPct = fromHighPct - expectedPct;

  let label: DropBreakdown["label"];
  if (fromHighPct > -5) label = "Near high";
  else if (excessPct <= -10) label = "Company-specific";
  else if (excessPct >= 10) label = "Outperforming";
  else label = "Market-driven";

  return { fromHighPct, highDate: hi.date, benchmarkPct, beta, expectedPct, excessPct, label };
}

export function computeBeta(bars: Bar[], benchmark: Bar[], window = 252): number {
  const bMap = new Map(benchmark.map((b) => [b.date, b.close]));
  const xs: number[] = [];
  const ys: number[] = [];
  const recent = bars.slice(-(window + 1));
  for (let i = 1; i < recent.length; i++) {
    const b0 = bMap.get(recent[i - 1].date);
    const b1 = bMap.get(recent[i].date);
    if (b0 === undefined || b1 === undefined) continue;
    xs.push(b1 / b0 - 1);
    ys.push(recent[i].close / recent[i - 1].close - 1);
  }
  if (xs.length < 30) return 1;
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  let varX = 0;
  for (let i = 0; i < xs.length; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    varX += (xs[i] - mx) ** 2;
  }
  return varX === 0 ? 1 : cov / varX;
}

function mean(a: number[]): number {
  return a.reduce((x, y) => x + y, 0) / a.length;
}

function median(a: number[]): number {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
