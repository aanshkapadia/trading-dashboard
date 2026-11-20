"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { Bar } from "@/lib/types";
import type { SignalParams, SignalSeries } from "@/lib/engine/signals";

const C = {
  bg: "#12161d",
  grid: "#1c222c",
  text: "#8b95a5",
  up: "#22c55e",
  down: "#ef4444",
  band: "#64748b",
  mid: "#475569",
  sma: "#f59e0b",
  macd: "#a78bfa",
  signal: "#f59e0b",
  rsi: "#60a5fa",
};

/** Price + Bollinger Bands + 200 day average + buy/sell markers, with MACD and RSI panes below. */
export default function IndicatorChart({
  bars,
  s,
  params,
  days,
}: {
  bars: Bar[];
  s: SignalSeries;
  params: SignalParams;
  days: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart: IChartApi = createChart(ref.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: C.bg },
        textColor: C.text,
        fontSize: 11,
        panes: { separatorColor: "#232a35", separatorHoverColor: "#334155", enableResize: true },
      },
      grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
      rightPriceScale: { borderColor: "#232a35" },
      timeScale: { borderColor: "#232a35" },
      crosshair: { mode: 0 },
    });

    const start = Math.max(0, bars.length - days);
    const t = (i: number) => bars[i].date as Time;
    const line = (vals: number[]) =>
      vals.slice(start).map((v, k) => (Number.isNaN(v) ? { time: t(start + k) } : { time: t(start + k), value: v }));

    // Pane 0: price
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: C.up,
      downColor: C.down,
      wickUpColor: C.up,
      wickDownColor: C.down,
      borderVisible: false,
    });
    candles.setData(bars.slice(start).map((b) => ({ time: b.date as Time, open: b.open, high: b.high, low: b.low, close: b.close })));
    const bandOpts = { color: C.band, lineWidth: 1 as const, lineStyle: 2, priceLineVisible: false, lastValueVisible: false };
    chart.addSeries(LineSeries, bandOpts).setData(line(s.bbUpper));
    chart.addSeries(LineSeries, { ...bandOpts, color: C.mid }).setData(line(s.bbMiddle));
    chart.addSeries(LineSeries, bandOpts).setData(line(s.bbLower));
    chart
      .addSeries(LineSeries, { color: C.sma, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: "200d" })
      .setData(line(s.sma200));

    const markers = [];
    for (let i = start; i < bars.length; i++) {
      const sug = s.suggestion[i];
      const prev = s.suggestion[i - 1];
      if (sug === "BUY" && prev !== "BUY")
        markers.push({ time: t(i), position: "belowBar" as const, color: C.up, shape: "arrowUp" as const, text: "Buy" });
      else if (sug === "SELL" && prev !== "SELL")
        markers.push({ time: t(i), position: "aboveBar" as const, color: C.down, shape: "arrowDown" as const, text: "Sell" });
    }
    createSeriesMarkers(candles, markers);

    // Pane 1: MACD
    chart
      .addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, 1)
      .setData(
        s.macdHist.slice(start).map((v, k) =>
          Number.isNaN(v) ? { time: t(start + k) } : { time: t(start + k), value: v, color: v >= 0 ? "#22c55e66" : "#ef444466" },
        ),
      );
    chart.addSeries(LineSeries, { color: C.macd, lineWidth: 1, priceLineVisible: false, title: "MACD" }, 1).setData(line(s.macd));
    chart.addSeries(LineSeries, { color: C.signal, lineWidth: 1, priceLineVisible: false, title: "Signal" }, 1).setData(line(s.macdSignal));

    // Pane 2: RSI with oversold / overbought guides
    const rsiSeries = chart.addSeries(LineSeries, { color: C.rsi, lineWidth: 1, priceLineVisible: false, title: "RSI" }, 2);
    rsiSeries.setData(line(s.rsi));
    rsiSeries.createPriceLine({ price: params.rsiBuy, color: C.up, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "" });
    rsiSeries.createPriceLine({ price: params.rsiSell, color: C.down, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "" });

    // Price gets ~56% of the height, MACD and RSI ~22% each.
    const panes = chart.panes();
    panes[0]?.setStretchFactor(2.5);
    panes[1]?.setStretchFactor(1);
    panes[2]?.setStretchFactor(1);
    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [bars, s, params.rsiBuy, params.rsiSell, days]);

  return <div ref={ref} className="h-[620px] w-full" />;
}
