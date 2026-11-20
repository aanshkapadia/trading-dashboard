// Technical indicators, written by hand so there is no dependency on pandas-ta style libraries.
// Every function returns an array aligned with the input (NaN where there isn't enough data yet).

export function sma(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values (same convention as most charting tools).
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(closes: number[], period = 14): number[] {
  const out = new Array<number>(closes.length).fill(NaN);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(ch, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-ch, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface BollingerBands {
  lower: number[];
  middle: number[];
  upper: number[];
  /** %B: 0 = at lower band, 1 = at upper band. */
  percentB: number[];
}

export function bollinger(closes: number[], period = 20, stdDev = 2): BollingerBands {
  const middle = sma(closes, period);
  const lower = new Array<number>(closes.length).fill(NaN);
  const upper = new Array<number>(closes.length).fill(NaN);
  const percentB = new Array<number>(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - middle[i]) ** 2;
    // Population std dev, matching the usual Bollinger definition.
    const sd = Math.sqrt(variance / period);
    lower[i] = middle[i] - stdDev * sd;
    upper[i] = middle[i] + stdDev * sd;
    const width = upper[i] - lower[i];
    percentB[i] = width === 0 ? 0.5 : (closes[i] - lower[i]) / width;
  }
  return { lower, middle, upper, percentB };
}

export interface Macd {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): Macd {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const line = closes.map((_, i) => fastEma[i] - slowEma[i]);
  // Signal line is an EMA of the MACD line, computed only over the valid part.
  const firstValid = line.findIndex((v) => !Number.isNaN(v));
  const signal = new Array<number>(closes.length).fill(NaN);
  if (firstValid >= 0) {
    const sig = ema(line.slice(firstValid), signalPeriod);
    sig.forEach((v, i) => (signal[firstValid + i] = v));
  }
  const histogram = line.map((v, i) => v - signal[i]);
  return { macd: line, signal, histogram };
}
