"use client";

import { DEFAULT_PARAMS, ORIGINAL_PARAMS, type SignalParams } from "@/lib/engine/signals";
import { DEFAULT_BACKTEST, type BacktestParams } from "@/lib/engine/backtest";

interface Props {
  params: SignalParams;
  onParams: (p: SignalParams) => void;
  bt: BacktestParams;
  onBt: (p: BacktestParams) => void;
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
  hint?: string;
}) {
  return (
    <label className="block py-1.5" title={props.hint}>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{props.label}</span>
        <span className="num">{props.fmt ? props.fmt(props.value) : props.value}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export default function SettingsPanel({ params: p, onParams, bt, onBt }: Props) {
  const set = <K extends keyof SignalParams>(k: K, v: SignalParams[K]) => onParams({ ...p, [k]: v });
  const setBt = <K extends keyof BacktestParams>(k: K, v: BacktestParams[K]) => onBt({ ...bt, [k]: v });
  const isDefault = JSON.stringify(p) === JSON.stringify(DEFAULT_PARAMS);
  const isOriginal = JSON.stringify(p) === JSON.stringify(ORIGINAL_PARAMS);

  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Presets</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onParams(DEFAULT_PARAMS)}
            className={`flex-1 rounded border px-2 py-1 text-xs ${isDefault ? "border-info text-info" : "border-line text-muted hover:text-ink"}`}
          >
            Swing (12/26/9)
          </button>
          <button
            onClick={() => onParams(ORIGINAL_PARAMS)}
            className={`flex-1 rounded border px-2 py-1 text-xs ${isOriginal ? "border-info text-info" : "border-line text-muted hover:text-ink"}`}
          >
            Original repo
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">RSI</h3>
        <Slider label="Period" value={p.rsiPeriod} min={5} max={30} step={1} onChange={(v) => set("rsiPeriod", v)} />
        <Slider label="Oversold below" value={p.rsiBuy} min={15} max={45} step={1} onChange={(v) => set("rsiBuy", v)} />
        <Slider label="Overbought above" value={p.rsiSell} min={55} max={85} step={1} onChange={(v) => set("rsiSell", v)} />
      </section>

      <section className="rounded-lg border border-line bg-panel p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Bollinger Bands</h3>
        <Slider label="Period" value={p.bbPeriod} min={10} max={50} step={1} onChange={(v) => set("bbPeriod", v)} />
        <Slider label="Std dev" value={p.bbStd} min={1} max={3} step={0.1} onChange={(v) => set("bbStd", v)} fmt={(v) => v.toFixed(1)} />
        <Slider
          label="Near lower band (%B below)"
          value={p.bbBuyPct}
          min={0}
          max={0.3}
          step={0.01}
          onChange={(v) => set("bbBuyPct", v)}
          fmt={(v) => v.toFixed(2)}
          hint="%B of 0 = price at the lower band, 1 = at the upper band"
        />
        <Slider label="Near upper band (%B above)" value={p.bbSellPct} min={0.7} max={1} step={0.01} onChange={(v) => set("bbSellPct", v)} fmt={(v) => v.toFixed(2)} />
      </section>

      <section className="rounded-lg border border-line bg-panel p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">MACD</h3>
        <Slider label="Fast" value={p.macdFast} min={3} max={20} step={1} onChange={(v) => set("macdFast", v)} />
        <Slider label="Slow" value={p.macdSlow} min={10} max={50} step={1} onChange={(v) => set("macdSlow", v)} />
        <Slider label="Signal" value={p.macdSignal} min={3} max={20} step={1} onChange={(v) => set("macdSignal", v)} />
        <Slider
          label="Crossover counts for (bars)"
          value={p.crossLookback}
          min={1}
          max={10}
          step={1}
          onChange={(v) => set("crossLookback", v)}
          hint="A crossover within the last N bars still counts toward a signal"
        />
        <label className="mt-2 block text-xs">
          <span className="text-muted">Trend filter (buys only)</span>
          <select
            value={p.trendFilter}
            onChange={(e) => set("trendFilter", e.target.value as SignalParams["trendFilter"])}
            className="mt-1 w-full rounded border border-line bg-panel2 px-2 py-1"
          >
            <option value="off">Off</option>
            <option value="above200">Only above 200 day average</option>
            <option value="below200">Only below 200 day average (dip buys)</option>
          </select>
        </label>
      </section>

      <section className="rounded-lg border border-line bg-panel p-3">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Backtest</h3>
        <Slider label="Test period (trading days)" value={bt.lookbackDays} min={60} max={400} step={10} onChange={(v) => setBt("lookbackDays", v)} />
        <Slider label="Costs per side (bps)" value={bt.costBps} min={0} max={50} step={1} onChange={(v) => setBt("costBps", v)} />
        <Slider label="Stop loss" value={bt.stopLossPct} min={0} max={30} step={1} onChange={(v) => setBt("stopLossPct", v)} fmt={(v) => (v ? `${v}%` : "off")} />
        <Slider label="Take profit" value={bt.takeProfitPct} min={0} max={60} step={1} onChange={(v) => setBt("takeProfitPct", v)} fmt={(v) => (v ? `${v}%` : "off")} />
        <button onClick={() => onBt(DEFAULT_BACKTEST)} className="mt-1 text-xs text-muted hover:text-ink">
          Reset backtest settings
        </button>
      </section>
    </aside>
  );
}
