"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketDataResponse, Portfolio } from "@/lib/types";
import { DEFAULT_PARAMS, type SignalParams } from "@/lib/engine/signals";
import { DEFAULT_BACKTEST, type BacktestParams } from "@/lib/engine/backtest";
import { buildScan } from "@/lib/engine/scan";
import { BENCHMARK, DEFAULT_WATCHLIST } from "@/lib/config";
import ScannerTable from "./ScannerTable";
import SettingsPanel from "./SettingsPanel";
import TickerDetail from "./TickerDetail";
import { fmtUsd } from "./format";

const LS = { watchlist: "td.watchlist", params: "td.params", bt: "td.bt" };

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...(fallback as object), ...JSON.parse(raw) } as T : fallback;
  } catch {
    return fallback;
  }
}

export default function Dashboard() {
  // This component only renders in the browser (see ClientDashboard), so reading localStorage here is safe.
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const wl = localStorage.getItem(LS.watchlist);
      return wl ? JSON.parse(wl) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });
  const [params, setParams] = useState<SignalParams>(() => load(LS.params, DEFAULT_PARAMS));
  const [bt, setBt] = useState<BacktestParams>(() => load(LS.bt, DEFAULT_BACKTEST));
  const [connected, setConnected] = useState<boolean | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [market, setMarket] = useState<MarketDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [newTicker, setNewTicker] = useState("");
  const [showSettings, setShowSettings] = useState(true);
  const [notice, setNotice] = useState<string | null>(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected")) return "Robinhood connected.";
    if (q.get("auth_error")) return `Robinhood sign in failed: ${q.get("auth_error")}`;
    return null;
  });

  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", "/");
  }, []);
  useEffect(() => localStorage.setItem(LS.watchlist, JSON.stringify(watchlist)), [watchlist]);
  useEffect(() => localStorage.setItem(LS.params, JSON.stringify(params)), [params]);
  useEffect(() => localStorage.setItem(LS.bt, JSON.stringify(bt)), [bt]);

  const holdings = useMemo(() => portfolio?.equities.map((e) => e.symbol) ?? [], [portfolio]);
  const symbols = useMemo(() => [...new Set([...watchlist, ...holdings, BENCHMARK])], [watchlist, holdings]);

  const load_ = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const st = await fetch("/api/auth/status").then((r) => r.json());
        setConnected(st.connected);
        const pf = await fetch(`/api/portfolio${refresh ? "?refresh=1" : ""}`).then((r) => r.json());
        setPortfolio(pf.portfolio);
        if (pf.error) setError(pf.error);
        const syms = [...new Set([...watchlist, ...(pf.portfolio?.equities ?? []).map((e: { symbol: string }) => e.symbol), BENCHMARK])];
        const res = await fetch(`/api/market?symbols=${syms.join(",")}${refresh ? "&refresh=1" : ""}`);
        const md = await res.json();
        if (!res.ok) throw new Error(md.error ?? "Failed to load market data");
        setMarket(md);
        if (md.errors?.length) setError(md.errors.join(" · "));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [watchlist],
  );

  // Fetch on mount and whenever the watchlist changes (a new ticker needs its bars).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching: loading/error state is set by design
    load_();
  }, [load_]);

  const rows = useMemo(
    () => (market ? buildScan(market.bars, market.fundamentals, params, portfolio, BENCHMARK) : []),
    [market, params, portfolio],
  );

  const active = selected && market?.bars[selected] ? selected : (rows[0]?.symbol ?? null);

  const addTicker = () => {
    const t = newTicker.trim().toUpperCase();
    if (/^[A-Z.]{1,6}$/.test(t) && !watchlist.includes(t)) setWatchlist([...watchlist, t]);
    setNewTicker("");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setPortfolio(null);
    load_(true);
  };

  const missing = symbols.filter((s) => market && !market.bars[s]?.length);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Trading Dashboard</h1>
        {market && (
          <span
            className={`rounded px-2 py-0.5 text-xs ${market.source === "robinhood" ? "bg-up/15 text-up" : "bg-warn/15 text-warn"}`}
            title={`As of ${new Date(market.asOf).toLocaleString()}`}
          >
            {market.source === "robinhood" ? "Robinhood data" : "Sample data"}
          </span>
        )}
        {portfolio && (
          <span className="text-xs text-muted">
            {portfolio.accountLabel} · {fmtUsd(portfolio.totalValue, 0)} · cash {fmtUsd(portfolio.cash, 0)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addTicker();
            }}
            className="flex"
          >
            <input
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
              placeholder="Add ticker"
              className="w-28 rounded-l border border-line bg-panel px-2 py-1 text-sm uppercase placeholder:normal-case"
            />
            <button className="rounded-r border border-l-0 border-line bg-panel2 px-2 text-sm">+</button>
          </form>
          <button onClick={() => setShowSettings((v) => !v)} className="rounded border border-line px-2.5 py-1 text-sm text-muted hover:text-ink">
            {showSettings ? "Hide settings" : "Settings"}
          </button>
          <button
            onClick={() => load_(true)}
            disabled={loading}
            className="rounded border border-line px-2.5 py-1 text-sm text-muted hover:text-ink disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          {connected === false && (
            <a href="/api/auth/login" className="rounded bg-up px-3 py-1 text-sm font-medium text-black hover:opacity-90">
              Connect Robinhood
            </a>
          )}
          {connected && (
            <button onClick={logout} className="text-xs text-muted hover:text-down">
              Disconnect
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className="mb-3 flex justify-between rounded border border-info/30 bg-info/10 px-3 py-2 text-sm">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted">✕</button>
        </div>
      )}
      {connected === false && (
        <div className="mb-3 rounded border border-warn/30 bg-warn/10 px-3 py-2 text-sm">
          Showing <b>sample data</b>. Connect Robinhood to scan real prices and flag what you own. Read only: this app never places or
          changes orders.
        </div>
      )}
      {error && <div className="mb-3 rounded border border-down/30 bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}
      {missing.length > 0 && <div className="mb-3 text-xs text-muted">No data for: {missing.join(", ")}</div>}

      <div className={`grid gap-4 ${showSettings ? "lg:grid-cols-[260px_1fr]" : ""}`}>
        {showSettings && <SettingsPanel params={params} onParams={setParams} bt={bt} onBt={setBt} />}

        <main className="min-w-0 space-y-4">
          {!market && loading && <div className="rounded-lg border border-line bg-panel p-10 text-center text-muted">Loading market data…</div>}
          {market && (
            <ScannerTable
              rows={rows}
              selected={active}
              onSelect={setSelected}
              onRemove={(s) => {
                setWatchlist(watchlist.filter((w) => w !== s));
                if (selected === s) setSelected(null);
              }}
            />
          )}
          {market && active && market.bars[active]?.length > 40 && (
            <section className="rounded-lg border border-line bg-panel p-4">
              <TickerDetail
                key={active}
                symbol={active}
                bars={market.bars[active]}
                benchmark={market.bars[BENCHMARK] ?? []}
                fundamentals={market.fundamentals[active]}
                portfolio={portfolio}
                params={params}
                bt={bt}
              />
            </section>
          )}
          <p className="pb-6 text-center text-[11px] text-muted">
            Signals: bullish MACD crossover plus RSI oversold or price near the lower Bollinger Band. Daily bars. Backtests fill at the
            next open and ignore taxes. Past signals don&apos;t guarantee future results.
          </p>
        </main>
      </div>
    </div>
  );
}
