import "server-only";
import type { Bar, Fundamentals, MarketDataResponse, Portfolio } from "../types";
import { callReadTool } from "../robinhood/client";

interface RhBar {
  begins_at: string;
  open_price: string;
  high_price: string;
  low_price: string;
  close_price: string;
  volume: number;
  interpolated?: boolean;
}

const chunk = <T,>(a: T[], n: number) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export async function fetchRobinhoodMarketData(symbols: string[], years = 2): Promise<MarketDataResponse> {
  const errors: string[] = [];
  const bars: Record<string, Bar[]> = {};
  const fundamentals: Record<string, Fundamentals> = {};
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() - years);
  const startTime = start.toISOString().slice(0, 10);

  // Daily bars: up to 10 symbols per call.
  await Promise.all(
    chunk(symbols, 10).map(async (group) => {
      try {
        const data = await callReadTool<{ results: { symbol: string; bars: RhBar[] }[] }>("get_equity_historicals", {
          symbols: group,
          start_time: startTime,
          interval: "day",
        });
        for (const r of data.results ?? []) {
          bars[r.symbol] = r.bars
            .filter((b) => !b.interpolated)
            .map((b) => ({
              date: b.begins_at.slice(0, 10),
              open: parseFloat(b.open_price),
              high: parseFloat(b.high_price),
              low: parseFloat(b.low_price),
              close: parseFloat(b.close_price),
              volume: b.volume,
            }));
        }
      } catch (e) {
        errors.push(`Bars for ${group.join(", ")}: ${(e as Error).message}`);
      }
    }),
  );

  // Fundamentals: up to 20 per call.
  await Promise.all(
    chunk(symbols, 20).map(async (group) => {
      try {
        const data = await callReadTool<{ results: Record<string, unknown>[] }>("get_equity_fundamentals", {
          symbols: group,
        });
        for (const f of data.results ?? []) {
          const symbol = String(f.symbol);
          fundamentals[symbol] = {
            symbol,
            peRatio: num(f.pe_ratio),
            high52w: num(f.high_52_weeks),
            low52w: num(f.low_52_weeks),
            marketCap: num(f.market_cap),
            sector: (f.sector as string) ?? null,
            industry: (f.industry as string) ?? null,
          };
        }
      } catch (e) {
        errors.push(`Fundamentals: ${(e as Error).message}`);
      }
    }),
  );

  // Historicals only include completed daily bars. During market hours, append today's
  // partial bar from the live quote so the scanner reflects the current price.
  try {
    const q = await callReadTool<{ results: { quote: Record<string, unknown> }[] }>("get_equity_quotes", {
      symbols,
    });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    for (const { quote } of q.results ?? []) {
      const sym = String(quote.symbol);
      const series = bars[sym];
      const last = num(quote.last_trade_price);
      const tradeTime = String(quote.venue_last_trade_time ?? "");
      if (!series?.length || last === null || !tradeTime) continue;
      const tradeDay = new Date(tradeTime).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      if (tradeDay === today && series[series.length - 1].date < today) {
        series.push({ date: today, open: last, high: last, low: last, close: last, volume: 0 });
      }
    }
  } catch (e) {
    errors.push(`Live quotes: ${(e as Error).message}`);
  }

  return { source: "robinhood", asOf: new Date().toISOString(), bars, fundamentals, errors };
}

interface RhAccount {
  account_number: string;
  is_default: boolean;
  brokerage_account_type?: string;
  nickname?: string;
}

export async function fetchRobinhoodPortfolio(): Promise<Portfolio> {
  const { accounts } = await callReadTool<{ accounts: RhAccount[] }>("get_accounts");
  const acct = accounts.find((a) => a.is_default) ?? accounts[0];
  const n = acct.account_number;

  const [pf, eq, op] = await Promise.all([
    callReadTool<Record<string, unknown>>("get_portfolio", { account_number: n }),
    callReadTool<{ positions: Record<string, string>[] }>("get_equity_positions", { account_number: n }),
    callReadTool<{ positions: Record<string, string>[] }>("get_option_positions", { account_number: n, nonzero: true }),
  ]);

  const optPositions = op.positions ?? [];
  const ids = optPositions.map((p) => p.option_id).filter(Boolean);
  const instruments = new Map<string, { strike: number | null; type: string }>();
  if (ids.length) {
    const inst = await callReadTool<{ instruments: Record<string, string>[] }>("get_option_instruments", {
      ids: ids.join(","),
    });
    for (const i of inst.instruments ?? []) instruments.set(i.id, { strike: num(i.strike_price), type: i.type });
  }

  return {
    accountLabel: acct.nickname || acct.brokerage_account_type || "Robinhood",
    totalValue: num(pf.total_value),
    cash: num(pf.cash),
    equities: (eq.positions ?? []).map((p) => ({
      symbol: p.symbol,
      quantity: parseFloat(p.quantity),
      averageCost: parseFloat(p.average_buy_price),
    })),
    options: optPositions.map((p) => {
      const i = instruments.get(p.option_id);
      return {
        symbol: p.chain_symbol,
        type: i?.type === "call" || i?.type === "put" ? i.type : "unknown",
        strike: i?.strike ?? null,
        expiration: p.expiration_date,
        quantity: parseFloat(p.quantity),
        averagePrice: parseFloat(p.average_price),
      };
    }),
  };
}
