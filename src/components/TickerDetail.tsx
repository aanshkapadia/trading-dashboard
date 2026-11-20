"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Bar, Fundamentals, Portfolio } from "@/lib/types";
import { computeSignals, type SignalParams } from "@/lib/engine/signals";
import { runBacktest, type BacktestParams } from "@/lib/engine/backtest";
import { dropBreakdown, forwardReturns } from "@/lib/engine/analysis";
import { fmtNum, fmtPct, fmtUsd, tone } from "./format";

const IndicatorChart = dynamic(() => import("./IndicatorChart"), { ssr: false });
const EquityChart = dynamic(() => import("./EquityChart"), { ssr: false });

const RANGES = [
  { label: "3M", days: 63 },
  { label: "6M", days: 126 },
  { label: "1Y", days: 252 },
  { label: "2Y", days: 504 },
];

function Stat({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="rounded border border-line bg-panel2 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`num mt-0.5 text-sm ${className}`}>{value}</div>
    </div>
  );
}

export default function TickerDetail({
  symbol,
  bars,
  benchmark,
  fundamentals,
  portfolio,
  params,
  bt,
}: {
  symbol: string;
  bars: Bar[];
  benchmark: Bar[];
  fundamentals?: Fundamentals;
  portfolio: Portfolio | null;
  params: SignalParams;
  bt: BacktestParams;
}) {
  const [range, setRange] = useState(252);
  const s = useMemo(() => computeSignals(bars, params), [bars, params]);
  const result = useMemo(() => runBacktest(bars, s, bt), [bars, s, bt]);
  const fwd = useMemo(() => forwardReturns(bars, s, "BUY"), [bars, s]);
  const drop = useMemo(() => (symbol === "QQQ" ? null : dropBreakdown(bars, benchmark)), [bars, benchmark, symbol]);

  const last = bars[bars.length - 1];
  const i = bars.length - 1;
  const pos = portfolio?.equities.find((e) => e.symbol === symbol);
  const opts = portfolio?.options.filter((o) => o.symbol === symbol) ?? [];
  const edge = result.totalReturnPct - result.buyHoldReturnPct;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {symbol} <span className="num ml-2 text-lg">{fmtUsd(last.close)}</span>
            <span className={`num ml-2 text-sm ${tone(last.close / bars[i - 1].close - 1)}`}>
              {fmtPct((last.close / bars[i - 1].close - 1) * 100)}
            </span>
          </h2>
          <p className="text-xs text-muted">
            Last bar {last.date}
            {fundamentals?.sector ? ` · ${fundamentals.sector}` : ""}
            {fundamentals?.industry ? ` · ${fundamentals.industry}` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={`rounded px-2 py-1 text-xs ${range === r.days ? "bg-panel2 text-ink" : "text-muted hover:text-ink"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="RSI" value={fmtNum(s.rsi[i], 1)} className={s.rsi[i] < params.rsiBuy ? "text-up" : s.rsi[i] > params.rsiSell ? "text-down" : ""} />
        <Stat label="%B" value={fmtNum(s.percentB[i], 2)} />
        <Stat label="MACD hist" value={fmtNum(s.macdHist[i], 2)} className={tone(s.macdHist[i])} />
        <Stat label="vs 200d avg" value={Number.isNaN(s.sma200[i]) ? "—" : fmtPct((last.close / s.sma200[i] - 1) * 100)} className={tone(last.close - s.sma200[i])} />
        <Stat label="P/E" value={fundamentals?.peRatio?.toFixed(1) ?? "—"} />
        <Stat label="52w high" value={fmtUsd(fundamentals?.high52w)} />
        <Stat label="Score" value={`${s.score[i] > 0 ? "+" : ""}${s.score[i]} · ${s.suggestion[i]}`} />
      </div>

      {(pos || opts.length > 0) && (
        <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm">
          <span className="font-medium text-info">You own this. </span>
          {pos && (
            <span>
              {pos.quantity} shares @ {fmtUsd(pos.averageCost)} ({fmtPct((last.close / pos.averageCost - 1) * 100)})
              {portfolio?.totalValue ? `, ${((pos.quantity * last.close) / portfolio.totalValue * 100).toFixed(1)}% of account` : ""}.{" "}
            </span>
          )}
          {opts.map((o, k) => (
            <span key={k} className="mr-3 text-muted">
              {o.quantity}× {o.expiration} ${o.strike ?? "?"} {o.type}
            </span>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line">
        <IndicatorChart bars={bars} s={s} params={params} days={range} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-line bg-panel p-3 lg:col-span-2">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Backtest: last {bt.lookbackDays} trading days</h3>
            <span className="text-xs text-muted">Fills at next open · {bt.costBps} bps per side</span>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Strategy" value={fmtPct(result.totalReturnPct)} className={tone(result.totalReturnPct)} />
            <Stat label="Buy & hold" value={fmtPct(result.buyHoldReturnPct)} className={tone(result.buyHoldReturnPct)} />
            <Stat label="Edge vs hold" value={fmtPct(edge)} className={tone(edge)} />
            <Stat label="Trades · win rate" value={`${result.trades.length} · ${fmtPct(result.winRatePct, 0, false)}`} />
            <Stat label="Avg trade" value={fmtPct(result.avgTradePct)} className={tone(result.avgTradePct)} />
            <Stat label="Max drawdown" value={fmtPct(result.maxDrawdownPct)} className="text-down" />
            <Stat label="Hold drawdown" value={fmtPct(result.buyHoldMaxDrawdownPct)} className="text-down" />
            <Stat label="Time in market" value={fmtPct(result.exposurePct, 0, false)} />
          </div>
          <EquityChart equity={result.equity} />
          {result.trades.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted hover:text-ink">Trades ({result.trades.length})</summary>
              <table className="mt-2 w-full text-xs">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1 text-left font-medium">Entry</th>
                    <th className="py-1 text-left font-medium">Exit</th>
                    <th className="py-1 text-right font-medium">Return</th>
                    <th className="py-1 text-right font-medium">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((t, k) => (
                    <tr key={k} className="border-t border-line/60">
                      <td className="num py-1">{t.entryDate} @ {fmtNum(t.entryPrice)}</td>
                      <td className="num py-1">{t.exitDate ? `${t.exitDate} @ ${fmtNum(t.exitPrice)}` : "open"}</td>
                      <td className={`num py-1 text-right ${tone(t.returnPct)}`}>{fmtPct(t.returnPct)}</td>
                      <td className="py-1 text-right text-muted">{t.exitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </section>

        <div className="space-y-4">
          <section className="rounded-lg border border-line bg-panel p-3">
            <h3 className="mb-1 text-sm font-semibold">What happened after Buy signals</h3>
            <p className="mb-2 text-xs text-muted">Return from the next open, vs the average from any day (full history).</p>
            <table className="w-full text-xs">
              <thead className="text-muted">
                <tr>
                  <th className="py-1 text-left font-medium">After</th>
                  <th className="py-1 text-right font-medium">Avg</th>
                  <th className="py-1 text-right font-medium">Win %</th>
                  <th className="py-1 text-right font-medium">Any day</th>
                  <th className="py-1 text-right font-medium">n</th>
                </tr>
              </thead>
              <tbody>
                {fwd.map((f) => (
                  <tr key={f.horizon} className="border-t border-line/60">
                    <td className="py-1">{f.horizon}d</td>
                    <td className={`num py-1 text-right ${tone(f.avgPct)}`}>{fmtPct(f.avgPct)}</td>
                    <td className="num py-1 text-right">{fmtPct(f.pctPositive, 0, false)}</td>
                    <td className={`num py-1 text-right ${tone(f.baselineAvgPct)}`}>{fmtPct(f.baselineAvgPct)}</td>
                    <td className="num py-1 text-right text-muted">{f.samples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fwd[0].samples < 5 && <p className="mt-2 text-xs text-warn">Small sample. Treat these numbers as a rough hint.</p>}
          </section>

          {drop && (
            <section className="rounded-lg border border-line bg-panel p-3">
              <h3 className="mb-1 text-sm font-semibold">Market dip or company problem?</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted">Down from 1y high ({drop.highDate})</span><span className={`num ${tone(drop.fromHighPct)}`}>{fmtPct(drop.fromHighPct)}</span></div>
                <div className="flex justify-between"><span className="text-muted">QQQ over the same window</span><span className={`num ${tone(drop.benchmarkPct)}`}>{fmtPct(drop.benchmarkPct)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Beta vs QQQ (1y)</span><span className="num">{drop.beta.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Expected from the market alone</span><span className="num">{fmtPct(drop.expectedPct)}</span></div>
                <div className="flex justify-between border-t border-line pt-1"><span className="text-muted">Unexplained (company specific)</span><span className={`num ${tone(drop.excessPct)}`}>{fmtPct(drop.excessPct)}</span></div>
              </div>
              <p className={`mt-2 text-sm font-medium ${drop.label === "Company-specific" ? "text-down" : drop.label === "Market-driven" ? "text-info" : "text-muted"}`}>
                {drop.label}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
