export const fmtPct = (v: number | null | undefined, digits = 1, sign = true) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `${sign && v > 0 ? "+" : ""}${v.toFixed(digits)}%`;

export const fmtNum = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const fmtUsd = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || Number.isNaN(v) ? "—" : `$${fmtNum(v, digits)}`;

export const tone = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? "text-muted" : v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted";
