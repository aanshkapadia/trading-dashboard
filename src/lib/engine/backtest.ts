import type { Bar } from "../types";
import type { SignalSeries } from "./signals";

export interface BacktestParams {
  startingCash: number;
  /** Fees + slippage per side, in basis points (5 = 0.05%). */
  costBps: number;
  /** 0 disables. Exit if the close falls this % below entry. */
  stopLossPct: number;
  /** 0 disables. Exit if the close rises this % above entry. */
  takeProfitPct: number;
  /** Only test the last N trading days (indicators still use the full history). */
  lookbackDays: number;
}

export const DEFAULT_BACKTEST: BacktestParams = {
  startingCash: 10_000,
  costBps: 5,
  stopLossPct: 0,
  takeProfitPct: 0,
  lookbackDays: 252,
};

export interface Trade {
  entryDate: string;
  entryPrice: number;
  exitDate: string | null;
  exitPrice: number | null;
  /** Return including costs; open trades are marked to the last close. */
  returnPct: number;
  exitReason: "signal" | "stop" | "target" | "open";
}

export interface EquityPoint {
  date: string;
  strategy: number;
  buyHold: number;
}

export interface BacktestResult {
  trades: Trade[];
  equity: EquityPoint[];
  totalReturnPct: number;
  buyHoldReturnPct: number;
  winRatePct: number | null;
  avgTradePct: number | null;
  maxDrawdownPct: number;
  buyHoldMaxDrawdownPct: number;
  exposurePct: number;
}

/**
 * Long-only, all-in / all-out backtest.
 * Fixes vs the original: trades fill at the NEXT bar's open (no lookahead), open positions are
 * marked to market, costs are included, and every result is shown next to buy & hold.
 */
export function runBacktest(bars: Bar[], s: SignalSeries, p: BacktestParams): BacktestResult {
  const n = bars.length;
  const start = Math.max(1, n - Math.max(20, Math.round(p.lookbackDays)));
  const cost = p.costBps / 10_000;

  let cash = p.startingCash;
  let shares = 0;
  let entryPrice = 0;
  let entryDate = "";
  let pendingBuy = false;
  let pendingSell: Trade["exitReason"] | null = null;
  const trades: Trade[] = [];
  const equity: EquityPoint[] = [];
  const bhShares = p.startingCash / bars[start].open;
  let barsInMarket = 0;

  for (let i = start; i < n; i++) {
    const bar = bars[i];

    // Fill orders decided on the previous bar at today's open.
    if (pendingBuy && shares === 0) {
      const px = bar.open * (1 + cost);
      shares = cash / px;
      cash = 0;
      entryPrice = px;
      entryDate = bar.date;
    } else if (pendingSell && shares > 0) {
      const px = bar.open * (1 - cost);
      cash = shares * px;
      trades.push({
        entryDate,
        entryPrice,
        exitDate: bar.date,
        exitPrice: px,
        returnPct: (px / entryPrice - 1) * 100,
        exitReason: pendingSell,
      });
      shares = 0;
    }
    pendingBuy = false;
    pendingSell = null;

    if (shares > 0) barsInMarket++;

    // Decide for tomorrow based on today's close.
    if (i < n - 1) {
      if (shares === 0 && s.suggestion[i] === "BUY") pendingBuy = true;
      else if (shares > 0) {
        const chg = (bar.close / entryPrice - 1) * 100;
        if (p.stopLossPct > 0 && chg <= -p.stopLossPct) pendingSell = "stop";
        else if (p.takeProfitPct > 0 && chg >= p.takeProfitPct) pendingSell = "target";
        else if (s.suggestion[i] === "SELL") pendingSell = "signal";
      }
    }

    equity.push({
      date: bar.date,
      strategy: cash + shares * bar.close,
      buyHold: bhShares * bar.close,
    });
  }

  if (shares > 0) {
    const last = bars[n - 1];
    trades.push({
      entryDate,
      entryPrice,
      exitDate: null,
      exitPrice: null,
      returnPct: ((last.close * (1 - cost)) / entryPrice - 1) * 100,
      exitReason: "open",
    });
  }

  const final = equity[equity.length - 1];
  const wins = trades.filter((t) => t.returnPct > 0).length;

  return {
    trades,
    equity,
    totalReturnPct: (final.strategy / p.startingCash - 1) * 100,
    buyHoldReturnPct: (final.buyHold / p.startingCash - 1) * 100,
    winRatePct: trades.length ? (wins / trades.length) * 100 : null,
    avgTradePct: trades.length ? trades.reduce((a, t) => a + t.returnPct, 0) / trades.length : null,
    maxDrawdownPct: maxDrawdown(equity.map((e) => e.strategy)),
    buyHoldMaxDrawdownPct: maxDrawdown(equity.map((e) => e.buyHold)),
    exposurePct: (barsInMarket / equity.length) * 100,
  };
}

export function maxDrawdown(values: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    worst = Math.min(worst, (v / peak - 1) * 100);
  }
  return worst;
}
