import "server-only";
import type { MarketDataResponse, Portfolio } from "../types";
import { hasTokens } from "../robinhood/oauth";
import { NotConnectedError } from "../robinhood/client";
import { fetchRobinhoodMarketData, fetchRobinhoodPortfolio } from "./robinhood";
import { sampleMarketData, samplePortfolio } from "./sample";

// Small in-memory cache so moving sliders or reloading doesn't hammer Robinhood.
const TTL_MS = 5 * 60_000;
const g = globalThis as unknown as { __cache?: Map<string, { at: number; value: unknown }> };
const cache = (g.__cache ??= new Map());

async function cached<T>(key: string, fn: () => Promise<T>, force: boolean): Promise<T> {
  const hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function shouldUseRobinhood(forceSample: boolean): Promise<boolean> {
  if (forceSample || process.env.DATA_SOURCE === "sample") return false;
  return hasTokens();
}

export async function getMarketData(symbols: string[], opts: { sample?: boolean; force?: boolean } = {}) {
  const sorted = [...new Set(symbols)].sort();
  if (!(await shouldUseRobinhood(Boolean(opts.sample)))) return sampleMarketData(sorted);
  try {
    return await cached<MarketDataResponse>(`md:${sorted.join(",")}`, () => fetchRobinhoodMarketData(sorted), Boolean(opts.force));
  } catch (e) {
    if (e instanceof NotConnectedError) return { ...sampleMarketData(sorted), errors: [e.message] };
    throw e;
  }
}

export async function getPortfolio(opts: { sample?: boolean; force?: boolean } = {}): Promise<{ source: string; portfolio: Portfolio | null; error?: string }> {
  if (!(await shouldUseRobinhood(Boolean(opts.sample)))) return { source: "sample", portfolio: samplePortfolio() };
  try {
    return { source: "robinhood", portfolio: await cached("portfolio", fetchRobinhoodPortfolio, Boolean(opts.force)) };
  } catch (e) {
    return { source: "robinhood", portfolio: null, error: (e as Error).message };
  }
}
