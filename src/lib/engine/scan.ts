import type { Bar, Fundamentals, Portfolio } from "../types";
import { dropBreakdown, forwardReturns, type DropBreakdown } from "./analysis";
import { barsSinceBullishCross, computeSignals, type SignalParams, type Suggestion } from "./signals";

export interface ScanRow {
  symbol: string;
  price: number;
  changePct: number;
  rsi: number;
  percentB: number;
  macdState: "bull" | "bear";
  daysSinceCross: number | null;
  score: number;
  suggestion: Suggestion;
  aboveSma200: boolean | null;
  peRatio: number | null;
  drop: DropBreakdown | null;
  /** Avg 20-day return after past BUY signals on this ticker (null if none). */
  fwd20AfterBuy: number | null;
  fwd20Samples: number;
  owned: { shares: number; avgCost: number } | null;
  optionCount: number;
  weightPct: number | null;
}

const ORDER: Record<Suggestion, number> = { BUY: 0, SETUP: 1, NONE: 2, SELL: 3 };

export function buildScan(
  bars: Record<string, Bar[]>,
  fundamentals: Record<string, Fundamentals>,
  params: SignalParams,
  portfolio: Portfolio | null,
  benchmark = "QQQ",
): ScanRow[] {
  const bench = bars[benchmark] ?? [];
  const rows: ScanRow[] = [];

  for (const [symbol, b] of Object.entries(bars)) {
    if (b.length < 40) continue;
    const s = computeSignals(b, params);
    const i = b.length - 1;
    const pos = portfolio?.equities.find((e) => e.symbol === symbol) ?? null;
    const fwd = forwardReturns(b, s, "BUY", [20])[0];
    const value = pos ? pos.quantity * b[i].close : 0;

    rows.push({
      symbol,
      price: b[i].close,
      changePct: (b[i].close / b[i - 1].close - 1) * 100,
      rsi: s.rsi[i],
      percentB: s.percentB[i],
      macdState: s.macdHist[i] >= 0 ? "bull" : "bear",
      daysSinceCross: barsSinceBullishCross(s),
      score: s.score[i],
      suggestion: s.suggestion[i],
      aboveSma200: Number.isNaN(s.sma200[i]) ? null : b[i].close > s.sma200[i],
      peRatio: fundamentals[symbol]?.peRatio ?? null,
      drop: symbol === benchmark ? null : dropBreakdown(b, bench),
      fwd20AfterBuy: fwd.avgPct,
      fwd20Samples: fwd.samples,
      owned: pos ? { shares: pos.quantity, avgCost: pos.averageCost } : null,
      optionCount: portfolio?.options.filter((o) => o.symbol === symbol).length ?? 0,
      weightPct: pos && portfolio?.totalValue ? (value / portfolio.totalValue) * 100 : null,
    });
  }

  return rows.sort(
    (a, b) => ORDER[a.suggestion] - ORDER[b.suggestion] || b.score - a.score || a.rsi - b.rsi,
  );
}
