// Shared types used by the data layer, the engine and the UI.

export interface Bar {
  /** Trading day as YYYY-MM-DD (US/Eastern session date). */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Fundamentals {
  symbol: string;
  peRatio: number | null;
  high52w: number | null;
  low52w: number | null;
  marketCap: number | null;
  sector: string | null;
  industry: string | null;
}

export interface EquityPosition {
  symbol: string;
  quantity: number;
  averageCost: number;
}

export interface OptionPosition {
  symbol: string;
  type: "call" | "put" | "unknown";
  strike: number | null;
  expiration: string;
  quantity: number;
  averagePrice: number; // per contract, dollars
}

export interface Portfolio {
  accountLabel: string;
  totalValue: number | null;
  cash: number | null;
  equities: EquityPosition[];
  options: OptionPosition[];
}

export type DataSource = "robinhood" | "sample";

export interface MarketDataResponse {
  source: DataSource;
  asOf: string;
  bars: Record<string, Bar[]>;
  fundamentals: Record<string, Fundamentals>;
  errors: string[];
}
