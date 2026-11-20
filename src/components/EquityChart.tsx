"use client";

import { useEffect, useRef } from "react";
import { ColorType, createChart, LineSeries, type Time } from "lightweight-charts";
import type { EquityPoint } from "@/lib/engine/backtest";

export default function EquityChart({ equity }: { equity: EquityPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !equity.length) return;
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#12161d" }, textColor: "#8b95a5", fontSize: 11 },
      grid: { vertLines: { color: "#1c222c" }, horzLines: { color: "#1c222c" } },
      rightPriceScale: { borderColor: "#232a35" },
      timeScale: { borderColor: "#232a35" },
    });
    chart
      .addSeries(LineSeries, { color: "#60a5fa", lineWidth: 2, title: "Strategy", priceLineVisible: false })
      .setData(equity.map((e) => ({ time: e.date as Time, value: e.strategy })));
    chart
      .addSeries(LineSeries, { color: "#8b95a5", lineWidth: 1, lineStyle: 2, title: "Buy & hold", priceLineVisible: false })
      .setData(equity.map((e) => ({ time: e.date as Time, value: e.buyHold })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [equity]);

  return <div ref={ref} className="h-56 w-full" />;
}
