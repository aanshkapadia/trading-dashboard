"use client";

import { useMemo, useState } from "react";
import type { ScanRow } from "@/lib/engine/scan";
import { fmtNum, fmtPct, tone } from "./format";

type Filter = "all" | "BUY" | "SETUP" | "owned";
type SortKey = "default" | "symbol" | "changePct" | "rsi" | "percentB" | "fromHigh" | "excess" | "pe" | "fwd";

const BADGE: Record<ScanRow["suggestion"], string> = {
  BUY: "bg-up/15 text-up border-up/40",
  SETUP: "bg-warn/15 text-warn border-warn/40",
  SELL: "bg-down/15 text-down border-down/40",
  NONE: "text-muted border-line",
};
const LABEL: Record<ScanRow["suggestion"], string> = { BUY: "Buy", SETUP: "Setting up", SELL: "Sell", NONE: "None" };

export default function ScannerTable({
  rows,
  selected,
  onSelect,
  onRemove,
}: {
  rows: ScanRow[];
  selected: string | null;
  onSelect: (s: string) => void;
  onRemove: (s: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "default", dir: 1 });

  const counts = useMemo(
    () => ({
      all: rows.length,
      BUY: rows.filter((r) => r.suggestion === "BUY").length,
      SETUP: rows.filter((r) => r.suggestion === "SETUP").length,
      owned: rows.filter((r) => r.owned || r.optionCount).length,
    }),
    [rows],
  );

  const view = useMemo(() => {
    let v = rows.filter((r) =>
      filter === "all" ? true : filter === "owned" ? r.owned || r.optionCount : r.suggestion === filter,
    );
    if (sort.key !== "default") {
      const val = (r: ScanRow): number | string => {
        switch (sort.key) {
          case "symbol": return r.symbol;
          case "changePct": return r.changePct;
          case "rsi": return r.rsi;
          case "percentB": return r.percentB;
          case "fromHigh": return r.drop?.fromHighPct ?? 0;
          case "excess": return r.drop?.excessPct ?? 0;
          case "pe": return r.peRatio ?? Infinity;
          case "fwd": return r.fwd20AfterBuy ?? -Infinity;
          default: return 0;
        }
      };
      v = [...v].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
    }
    return v;
  }, [rows, filter, sort]);

  const th = (key: SortKey, label: string, title?: string) => (
    <th
      title={title}
      onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }))}
      className="cursor-pointer select-none whitespace-nowrap px-2 py-2 text-left font-medium hover:text-ink"
    >
      {label}
      {sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-2">
        {(["all", "BUY", "SETUP", "owned"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded px-2.5 py-1 text-xs ${filter === f ? "bg-panel2 text-ink" : "text-muted hover:text-ink"}`}
          >
            {f === "all" ? "All" : f === "owned" ? "Owned" : LABEL[f]} <span className="text-muted">{counts[f]}</span>
          </button>
        ))}
        {sort.key !== "default" && (
          <button onClick={() => setSort({ key: "default", dir: 1 })} className="ml-auto text-xs text-muted hover:text-ink">
            Reset sort
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              {th("symbol", "Ticker")}
              <th className="px-2 py-2 text-left font-medium">Signal</th>
              <th className="px-2 py-2 text-right font-medium">Price</th>
              {th("changePct", "Day")}
              {th("rsi", "RSI")}
              {th("percentB", "%B", "Position within the Bollinger Bands (0 = lower band, 1 = upper band)")}
              <th className="px-2 py-2 text-left font-medium" title="MACD vs signal line, and bars since the last bullish crossover">
                MACD
              </th>
              {th("fromHigh", "From high", "Drop from the 1 year closing high")}
              {th("excess", "Drop type", "Actual drop minus what beta × QQQ explains. Very negative = company specific")}
              {th("pe", "P/E")}
              {th("fwd", "Fwd 20d", "Average 20 day return after past Buy signals on this ticker (number of signals)")}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr
                key={r.symbol}
                onClick={() => onSelect(r.symbol)}
                className={`cursor-pointer border-b border-line/60 hover:bg-panel2 ${selected === r.symbol ? "bg-panel2" : ""}`}
              >
                <td className="px-2 py-1.5 font-semibold">
                  {r.symbol}
                  {r.owned && (
                    <span className="ml-1.5 rounded bg-info/15 px-1 text-[10px] font-normal text-info" title={`${r.owned.shares} shares @ $${r.owned.avgCost.toFixed(2)}`}>
                      {r.weightPct !== null ? `${r.weightPct.toFixed(0)}%` : "owned"}
                    </span>
                  )}
                  {r.optionCount > 0 && (
                    <span className="ml-1 rounded bg-warn/15 px-1 text-[10px] font-normal text-warn">{r.optionCount} opt</span>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-xs ${BADGE[r.suggestion]}`}>{LABEL[r.suggestion]}</span>
                  <span className="num ml-1.5 text-xs text-muted">{r.score > 0 ? `+${r.score}` : r.score}</span>
                </td>
                <td className="num px-2 py-1.5 text-right">{fmtNum(r.price)}</td>
                <td className={`num px-2 py-1.5 ${tone(r.changePct)}`}>{fmtPct(r.changePct)}</td>
                <td className={`num px-2 py-1.5 ${r.rsi < 30 ? "text-up" : r.rsi > 70 ? "text-down" : ""}`}>{fmtNum(r.rsi, 0)}</td>
                <td className={`num px-2 py-1.5 ${r.percentB < 0.1 ? "text-up" : r.percentB > 0.9 ? "text-down" : ""}`}>
                  {fmtNum(r.percentB, 2)}
                </td>
                <td className="num px-2 py-1.5 text-xs">
                  <span className={r.macdState === "bull" ? "text-up" : "text-down"}>{r.macdState === "bull" ? "▲" : "▼"}</span>
                  <span className="ml-1 text-muted">{r.daysSinceCross !== null ? `${r.daysSinceCross}d` : "—"}</span>
                </td>
                <td className={`num px-2 py-1.5 ${tone(r.drop?.fromHighPct)}`}>{fmtPct(r.drop?.fromHighPct, 0)}</td>
                <td className="px-2 py-1.5 text-xs">
                  {r.drop ? (
                    <span
                      className={
                        r.drop.label === "Company-specific" ? "text-down" : r.drop.label === "Market-driven" ? "text-info" : "text-muted"
                      }
                      title={`Beta ${r.drop.beta.toFixed(2)} × QQQ ${r.drop.benchmarkPct.toFixed(1)}% = expected ${r.drop.expectedPct.toFixed(1)}%. Excess ${r.drop.excessPct.toFixed(1)}%`}
                    >
                      {r.drop.label} <span className="num text-muted">{fmtPct(r.drop.excessPct, 0)}</span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num px-2 py-1.5">{r.peRatio !== null ? r.peRatio.toFixed(1) : "—"}</td>
                <td className={`num px-2 py-1.5 text-xs ${tone(r.fwd20AfterBuy)}`}>
                  {fmtPct(r.fwd20AfterBuy)} <span className="text-muted">({r.fwd20Samples})</span>
                </td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(r.symbol);
                    }}
                    className="text-xs text-muted opacity-50 hover:text-down hover:opacity-100"
                    title="Remove from watchlist"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {view.length === 0 && (
              <tr>
                <td colSpan={12} className="p-6 text-center text-sm text-muted">
                  Nothing matches this filter right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
