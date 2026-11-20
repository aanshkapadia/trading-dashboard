import type { Bar } from "../types";
import { bollinger, macd, rsi, sma } from "./indicators";

/**
 * Swing-tuned version of the original algorithm (aanshkapadia/algorithmic-trading-ta-indicators):
 *   BUY  = bullish MACD crossover (within the last `crossLookback` bars)
 *          AND (RSI oversold OR price near the lower Bollinger Band)
 *   SELL = bearish MACD crossover AND (RSI overbought OR price near the upper band)
 * Score keeps the original scale: RSI ±1, BB ±1, MACD crossover ±2 → range -4..4, |score| >= 3 triggers.
 */
export interface SignalParams {
  rsiPeriod: number;
  rsiBuy: number;
  rsiSell: number;
  bbPeriod: number;
  bbStd: number;
  bbBuyPct: number; // %B below this counts as "near lower band"
  bbSellPct: number; // %B above this counts as "near upper band"
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  crossLookback: number; // a crossover in the last N bars still counts
  trendFilter: "off" | "above200" | "below200";
}

export const DEFAULT_PARAMS: SignalParams = {
  rsiPeriod: 14,
  rsiBuy: 30,
  rsiSell: 70,
  bbPeriod: 20,
  bbStd: 2,
  bbBuyPct: 0.1,
  bbSellPct: 0.9,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  crossLookback: 3,
  trendFilter: "off",
};

/** The original repo's settings (fast MACD, same-bar crossover). */
export const ORIGINAL_PARAMS: SignalParams = {
  ...DEFAULT_PARAMS,
  macdFast: 5,
  macdSlow: 20,
  macdSignal: 10,
  crossLookback: 1,
};

export type Suggestion = "BUY" | "SELL" | "SETUP" | "NONE";

export interface SignalSeries {
  rsi: number[];
  bbLower: number[];
  bbMiddle: number[];
  bbUpper: number[];
  percentB: number[];
  macd: number[];
  macdSignal: number[];
  macdHist: number[];
  sma200: number[];
  /** +1 bullish cross on this bar, -1 bearish cross, 0 none. */
  cross: number[];
  score: number[];
  suggestion: Suggestion[];
}

export function computeSignals(bars: Bar[], p: SignalParams): SignalSeries {
  const closes = bars.map((b) => b.close);
  const r = rsi(closes, p.rsiPeriod);
  const bb = bollinger(closes, p.bbPeriod, p.bbStd);
  const m = macd(closes, p.macdFast, p.macdSlow, p.macdSignal);
  const s200 = sma(closes, 200);

  const n = bars.length;
  const cross = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const prev = m.macd[i - 1] - m.signal[i - 1];
    const cur = m.macd[i] - m.signal[i];
    if (Number.isNaN(prev) || Number.isNaN(cur)) continue;
    if (prev <= 0 && cur > 0) cross[i] = 1;
    else if (prev >= 0 && cur < 0) cross[i] = -1;
  }

  const score = new Array<number>(n).fill(0);
  const suggestion = new Array<Suggestion>(n).fill("NONE");
  const lookback = Math.max(1, Math.round(p.crossLookback));

  for (let i = 0; i < n; i++) {
    if (Number.isNaN(r[i]) || Number.isNaN(bb.percentB[i]) || Number.isNaN(m.signal[i])) continue;

    const rsiSig = r[i] < p.rsiBuy ? 1 : r[i] > p.rsiSell ? -1 : 0;
    const bbSig = bb.percentB[i] < p.bbBuyPct ? 1 : bb.percentB[i] > p.bbSellPct ? -1 : 0;

    // Most recent crossover within the lookback window, as long as MACD is still on that side.
    let crossSig = 0;
    for (let j = i; j > i - lookback && j >= 0; j--) {
      if (cross[j] !== 0) {
        const stillValid = cross[j] === 1 ? m.histogram[i] > 0 : m.histogram[i] < 0;
        crossSig = stillValid ? cross[j] * 2 : 0;
        break;
      }
    }

    const sc = rsiSig + bbSig + crossSig;
    score[i] = sc;

    const trendOk =
      p.trendFilter === "off" ||
      Number.isNaN(s200[i]) ||
      (p.trendFilter === "above200" ? closes[i] > s200[i] : closes[i] < s200[i]);

    // Rule from the original: a crossover plus at least one of RSI / BB.
    if (crossSig === 2 && rsiSig + bbSig >= 1 && trendOk) suggestion[i] = "BUY";
    else if (crossSig === -2 && rsiSig + bbSig <= -1) suggestion[i] = "SELL";
    else if (rsiSig + bbSig >= 1 && crossSig <= 0) suggestion[i] = "SETUP"; // oversold, waiting on MACD
  }

  return {
    rsi: r,
    bbLower: bb.lower,
    bbMiddle: bb.middle,
    bbUpper: bb.upper,
    percentB: bb.percentB,
    macd: m.macd,
    macdSignal: m.signal,
    macdHist: m.histogram,
    sma200: s200,
    cross,
    score,
    suggestion,
  };
}

/** Bars since the last bullish crossover (null if none in the series). */
export function barsSinceBullishCross(s: SignalSeries): number | null {
  for (let i = s.cross.length - 1; i >= 0; i--) {
    if (s.cross[i] === 1) return s.cross.length - 1 - i;
  }
  return null;
}
