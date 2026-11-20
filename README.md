# Trading Dashboard

Swing trade signal scanner for a Robinhood watchlist. It's the interactive follow up to
[algorithmic-trading-ta-indicators](https://github.com/aanshkapadia/algorithmic-trading-ta-indicators):
same RSI + Bollinger Band + MACD idea, but on daily bars, across a whole watchlist, with backtests you can tune live.

**Read only.** The app connects to Robinhood's official MCP server and only calls read tools
(positions, prices, fundamentals). Order tools are not wired in, and anything outside the allowlist in
`src/lib/robinhood/client.ts` throws before it reaches the network.

## What it does

- **Scanner.** Every ticker on your watchlist plus your Robinhood holdings, ranked by signal:
  - **Buy:** bullish MACD crossover (within the last N bars) plus RSI oversold or price near the lower Bollinger Band
  - **Setting up:** oversold but MACD hasn't turned yet
  - **Sell:** the mirror image
  - Columns for RSI, %B, MACD state, days since the last crossover, drop from the 1y high, P/E,
    and the average 20 day return after past Buy signals on that ticker
- **Market dip or company problem.** Each stock's drop from its high is compared with beta × QQQ's move over the
  same window. A big unexplained drop gets flagged as company specific (a falling knife risk); a drop in line
  with the market gets flagged as market driven.
- **Charts.** Candles with Bollinger Bands, the 200 day average and Buy/Sell markers, plus MACD and RSI panes.
- **Backtest.** All in / all out on the signals, filled at the next day's open with costs, optional stop loss and
  take profit, always shown next to buy & hold (strategy return, edge, win rate, drawdown, time in market).
- **What happened after the signal.** 5 / 20 / 60 day returns after each Buy signal vs the average from any day.
- **Your account as context.** Owned tickers show their weight in your account and any open option positions.
- **Sliders for everything.** RSI, Bollinger and MACD settings, crossover window, a 200 day trend filter,
  and presets for "Swing (12/26/9)" and the "Original repo" settings (5/20/10, same bar crossover).
  Settings and watchlist are saved in your browser.

## Run it

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

It starts on **sample data** (deterministic fake prices) so you can try it before connecting anything.

### Connect Robinhood

1. Click **Connect Robinhood**. The app registers itself with Robinhood's MCP server (OAuth with dynamic
   client registration + PKCE) and sends you to Robinhood to sign in.
2. After you approve, Robinhood redirects to `http://localhost:3000/api/auth/callback` and the app stores the
   tokens in `.data/robinhood-auth.json` (gitignored, file mode 600). Tokens refresh automatically.
3. **Disconnect** deletes that file.

If you run on a different port or host, set `APP_URL` so the redirect URL matches.

## Notes and limits

- Daily bars only (about 2 years per ticker). During market hours the latest price is appended as today's bar.
- Data is cached for 5 minutes; **Refresh** forces a new pull.
- Up to 40 tickers per scan to keep Robinhood calls reasonable.
- The OAuth store is single user and local. For a hosted deploy (e.g. Vercel), move it to an encrypted per user store
  and add your own login in front of the app.
- Backtests ignore taxes and assume you can always fill at the open. Small signal counts are noisy.

## Project layout

```
src/lib/engine/      indicators, signals, backtest, analysis (pure TS, unit tested)
src/lib/robinhood/   OAuth provider + read only MCP client
src/lib/data/        Robinhood and sample data providers, cache
src/app/api/         auth (login, callback, status, logout), market, portfolio
src/components/      dashboard UI (scanner, settings, charts, backtest)
```

```bash
npx vitest run   # engine tests
npm run build
```

## Ideas for next versions

- Push the top daily signals into the morning brief / phone notifications
- News watcher on holdings (headline → affected positions → what your rules say)
- Options view: P/L, days to expiry, exit rules, stock price targets for +50% / +100%
- Trade journal with returns by setup type vs holding QQQ
- Intraday bars for short dated plays
