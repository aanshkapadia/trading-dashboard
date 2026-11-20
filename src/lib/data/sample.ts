import type { Bar, Fundamentals, MarketDataResponse, Portfolio } from "../types";

// Deterministic fake data so the dashboard works before you connect Robinhood (and in CI).
// Each ticker gets a seeded random walk with a trend, volatility, and a late correction.

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function tradingDays(count: number): string[] {
  const days: string[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  while (days.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) days.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days;
}

/** Shared "market" daily returns: a gentle uptrend, then a ~15% correction over the last month. */
function marketReturns(n: number): number[] {
  const rnd = seeded(42);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  return Array.from({ length: n }, (_, i) => (i > n - 22 ? Math.log(0.85) / 22 : 0.0006) + 0.011 * gauss());
}

function makeSeries(symbol: string, days: string[], market: number[], benchmark: boolean): Bar[] {
  const rnd = seeded(hash(symbol));
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const beta = benchmark ? 1 : 0.7 + rnd() * 1.3;
  const idioVol = benchmark ? 0 : 0.008 + rnd() * 0.02;
  const vol = Math.sqrt((beta * 0.011) ** 2 + idioVol ** 2);
  // About a third of tickers get an extra company-specific selloff near the end.
  const hasNews = !benchmark && rnd() < 0.35;
  const newsLen = 10 + Math.floor(rnd() * 15);
  const newsDepth = 0.1 + rnd() * 0.25;
  const alpha = (rnd() - 0.4) * 0.0008;
  let price = 20 + rnd() * 400;
  const bars: Bar[] = [];

  days.forEach((date, i) => {
    const news = hasNews && i > days.length - newsLen ? Math.log(1 - newsDepth) / newsLen : 0;
    const ret = beta * market[i] + alpha + news + idioVol * gauss();
    const open = price * (1 + vol * 0.3 * gauss());
    price = Math.max(1, price * Math.exp(ret));
    const hi = Math.max(open, price) * (1 + Math.abs(gauss()) * vol * 0.5);
    const lo = Math.min(open, price) * (1 - Math.abs(gauss()) * vol * 0.5);
    bars.push({ date, open, high: hi, low: lo, close: price, volume: Math.round(1e6 + rnd() * 5e7) });
  });
  return bars;
}

export function sampleMarketData(symbols: string[]): MarketDataResponse {
  const days = tradingDays(504);
  const market = marketReturns(days.length);
  const bars: Record<string, Bar[]> = {};
  const fundamentals: Record<string, Fundamentals> = {};
  for (const s of symbols) {
    bars[s] = makeSeries(s, days, market, s === "QQQ");
    const rnd = seeded(hash(s + "f"));
    const closes = bars[s].slice(-252).map((b) => b.close);
    fundamentals[s] = {
      symbol: s,
      peRatio: rnd() < 0.15 ? null : Math.round((10 + rnd() * 90) * 10) / 10,
      high52w: Math.max(...closes),
      low52w: Math.min(...closes),
      marketCap: null,
      sector: null,
      industry: null,
    };
  }
  return { source: "sample", asOf: new Date().toISOString(), bars, fundamentals, errors: [] };
}

export function samplePortfolio(): Portfolio {
  return {
    accountLabel: "Sample account",
    totalValue: 50_000,
    cash: 2_500,
    equities: [
      { symbol: "NVDA", quantity: 40, averageCost: 120 },
      { symbol: "GOOGL", quantity: 20, averageCost: 180 },
      { symbol: "AMD", quantity: 10, averageCost: 200 },
    ],
    options: [{ symbol: "NVDA", type: "call", strike: 200, expiration: "2027-06-17", quantity: 1, averagePrice: 375 }],
  };
}
