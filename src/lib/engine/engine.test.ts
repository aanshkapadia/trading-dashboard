import { describe, expect, it } from "vitest";
import type { Bar } from "../types";
import { bollinger, ema, macd, rsi, sma } from "./indicators";
import { computeSignals, DEFAULT_PARAMS } from "./signals";
import { maxDrawdown, runBacktest, DEFAULT_BACKTEST } from "./backtest";
import { computeBeta, dropBreakdown, forwardReturns } from "./analysis";

function makeBars(closes: number[]): Bar[] {
  const start = new Date("2025-01-02T00:00:00Z");
  return closes.map((c, i) => {
    const d = new Date(start.getTime() + i * 86_400_000);
    return { date: d.toISOString().slice(0, 10), open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1_000_000 };
  });
}

describe("indicators", () => {
  it("sma", () => {
    expect(sma([1, 2, 3, 4, 5], 3).slice(2)).toEqual([2, 3, 4]);
    expect(Number.isNaN(sma([1, 2, 3], 3)[1])).toBe(true);
  });

  it("ema seeds with sma and converges on a constant", () => {
    const e = ema(new Array(50).fill(10), 10);
    expect(e[9]).toBe(10);
    expect(e[49]).toBeCloseTo(10);
  });

  it("rsi is 100 on a straight rise and ~0 on a straight fall", () => {
    const up = Array.from({ length: 30 }, (_, i) => 100 + i);
    const down = Array.from({ length: 30 }, (_, i) => 100 - i);
    expect(rsi(up)[29]).toBe(100);
    expect(rsi(down)[29]).toBeLessThan(1);
  });

  it("rsi matches a known Wilder value", () => {
    // Classic example series (Wilder / StockCharts). RSI(14) at bar 15 ≈ 70.53.
    const c = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0];
    expect(rsi(c, 14)[14]).toBeCloseTo(70.46, 0);
  });

  it("bollinger %B is 0.5 at the mean of a flat series", () => {
    const bb = bollinger(new Array(25).fill(50), 20, 2);
    expect(bb.percentB[24]).toBe(0.5);
    expect(bb.upper[24]).toBe(50);
  });

  it("macd histogram turns positive after a reversal", () => {
    const c = [...Array.from({ length: 60 }, (_, i) => 100 - i * 0.2 - i * i * 0.01), ...Array.from({ length: 30 }, (_, i) => 52 + i * 1.5)];
    const m = macd(c);
    expect(m.histogram[59]).toBeLessThan(0);
    expect(m.histogram[89]).toBeGreaterThan(0);
  });
});

describe("signals + backtest", () => {
  // Downtrend into an oversold bottom, then a sharp reversal: should produce a BUY.
  const closes = [
    ...Array.from({ length: 220 }, (_, i) => 100 + Math.sin(i / 8) * 3),
    ...Array.from({ length: 25 }, (_, i) => 100 - i * 1.6),
    ...Array.from({ length: 40 }, (_, i) => 60 + i * 1.2),
  ];
  const bars = makeBars(closes);
  const s = computeSignals(bars, DEFAULT_PARAMS);

  it("finds a buy signal near the bottom", () => {
    const buys = s.suggestion.map((x, i) => (x === "BUY" ? i : -1)).filter((i) => i >= 0);
    expect(buys.length).toBeGreaterThan(0);
    expect(buys.some((i) => i >= 240 && i <= 260)).toBe(true);
  });

  it("backtest fills next bar, marks open trades and reports buy & hold", () => {
    const r = runBacktest(bars, s, { ...DEFAULT_BACKTEST, lookbackDays: 120 });
    expect(r.trades.length).toBeGreaterThan(0);
    expect(r.equity.length).toBe(120);
    expect(r.totalReturnPct).toBeGreaterThan(0);
    expect(Number.isFinite(r.buyHoldReturnPct)).toBe(true);
    const first = r.trades[0];
    const sigIdx = s.suggestion.findIndex((x, i) => x === "BUY" && i >= bars.length - 120);
    expect(first.entryDate).toBe(bars[sigIdx + 1].date);
  });

  it("max drawdown", () => {
    expect(maxDrawdown([100, 120, 90, 130])).toBeCloseTo(-25);
  });

  it("forward returns count signal events once", () => {
    const f = forwardReturns(bars, s, "BUY", [5]);
    expect(f[0].samples).toBeGreaterThan(0);
    expect(f[0].baselineAvgPct).not.toBeNull();
  });
});

describe("drop breakdown", () => {
  it("beta of a 2x series is ~2 and flags company-specific weakness", () => {
    const bench = Array.from({ length: 300 }, (_, i) => 100 * (1 + 0.01 * Math.sin(i / 3)) * (1 - i * 0.0005));
    const stock2x: number[] = [100];
    for (let i = 1; i < bench.length; i++) stock2x.push(stock2x[i - 1] * (1 + 2 * (bench[i] / bench[i - 1] - 1)));
    const bBars = makeBars(bench);
    expect(computeBeta(makeBars(stock2x), bBars)).toBeCloseTo(2, 1);

    const weak = stock2x.map((c, i) => (i > 260 ? c * (1 - (i - 260) * 0.01) : c));
    const d = dropBreakdown(makeBars(weak), bBars);
    expect(d?.label).toBe("Company-specific");
  });
});
