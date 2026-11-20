// Default watchlist. Holdings from your Robinhood account are added automatically when connected,
// and you can add or remove tickers in the UI (saved in your browser).
export const DEFAULT_WATCHLIST = [
  "NVDA", "GOOGL", "META", "AMZN", "AMD", "PLTR", "TSLA", "HOOD", "SPOT",
  "TSM", "ASML", "AVGO", "MU", "SMH", "QQQ", "TQQQ", "LLY", "CIBR",
];

export const BENCHMARK = "QQQ";

/** Max tickers per scan, to keep Robinhood calls reasonable. */
export const MAX_SYMBOLS = 40;
