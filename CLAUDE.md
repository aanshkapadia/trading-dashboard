# CLAUDE.md

Context for Claude Code working in this repo. Also read `AGENTS.md` (Next.js 16 notes: check
`node_modules/next/dist/docs/` before using Next APIs, since this version differs from older training data).

## What this is

A local, single user Next.js 16 dashboard that scans a stock watchlist plus the user's Robinhood holdings for
swing trade signals, with interactive charts and backtests. It's the interactive successor to the owner's Python
project [algorithmic-trading-ta-indicators](https://github.com/aanshkapadia/algorithmic-trading-ta-indicators).

The owner trades swings and 1 to 7 month options, mostly in large cap tech, and buys dips in steps.
The tool exists to surface good setups, explain *why* a stock is down, and enforce discipline. It is not about speed
or high frequency trading.

## Hard rules

- **Read only. Never add order, alert, watchlist or any other write tool calls to Robinhood.**
  `src/lib/robinhood/client.ts` has a `READ_ONLY_TOOLS` allowlist; anything else throws. Only add read tools to it.
  If a future feature needs trade execution, stop and ask: it would go through Robinhood's separate agentic account
  with its trade approval setting on, never the main account.
- **This repo is public.** Never commit tokens, `.env*` files (except `.env.example`), `.data/`, account numbers,
  real positions, balances or anything personal. Sample data must stay fake. Keep personal config (real watchlists,
  journals, notes) in gitignored files or browser localStorage.
- Keep sample mode working: the app must run with no Robinhood connection (`DATA_SOURCE=sample` or not connected).
- Use plain, casual copy in the UI. Avoid hyphenated phrasing where an easy rewrite exists.

## Architecture

```
src/lib/engine/      Pure TypeScript, no I/O, unit tested (vitest). Runs in the browser so sliders are instant.
  indicators.ts      SMA, EMA, Wilder RSI, Bollinger (population std dev, %B), MACD
  signals.ts         Signal score and suggestions (BUY / SETUP / SELL / NONE), DEFAULT_PARAMS, ORIGINAL_PARAMS
  backtest.ts        Long only, all in/all out, fills at NEXT bar's open, costs in bps, stop/target, vs buy & hold
  analysis.ts        Forward returns after signals; beta vs QQQ and "market driven vs company specific" drop breakdown
  scan.ts            Builds scanner rows (engine + fundamentals + portfolio context)
src/lib/robinhood/   OAuth provider (DCR + PKCE, tokens in .data/robinhood-auth.json) and read only MCP client
src/lib/data/        robinhood.ts (MCP → Bar/Fundamentals/Portfolio), sample.ts (seeded fake data), index.ts (cache, source pick)
src/app/api/         auth/{login,callback,status,logout}, market (bars + fundamentals), portfolio
src/components/      Dashboard (state, localStorage), ScannerTable, SettingsPanel, TickerDetail, IndicatorChart,
                     EquityChart (lightweight-charts v5, panes via paneIndex + setStretchFactor)
```

### Signal logic

- BUY: bullish MACD crossover within the last `crossLookback` bars (MACD still above signal) AND
  (RSI < `rsiBuy` OR %B < `bbBuyPct`), plus the optional 200 day trend filter.
- SELL: the mirror image. SETUP: oversold (RSI or BB) but MACD hasn't crossed yet.
- Score keeps the original scale: RSI ±1, BB ±1, crossover ±2 (range -4..4).
- Defaults are swing tuned: daily bars, MACD 12/26/9, crossover counts for 3 bars. The "Original repo" preset uses
  MACD 5/20/10 with same bar crossover.

### Robinhood MCP

- Server: `https://agent.robinhood.com/mcp/trading` (official). Tool results are JSON text: `{ data, guide }`.
- `get_equity_historicals`: max 10 symbols per call, `interval: "day"`, ~2 years requested. Completed bars only;
  `fetchRobinhoodMarketData` appends today's partial bar from `get_equity_quotes` during market hours.
- `get_equity_fundamentals`: max 20 symbols per call. Positions come from the default account (`is_default`).
- Use `account_number` (alphanumeric) for equities/options tools, not `rhs_account_number`.
- 5 minute in-memory cache; `?refresh=1` bypasses it.

## Commands

```bash
npm run dev        # http://localhost:3000 (set APP_URL if you change host/port; it's the OAuth redirect base)
npm test           # vitest, engine tests
npm run build      # must pass before committing
npx eslint src
```

## Known v1 limits

- Backtest exits only on SELL signals unless stop loss / take profit is set, so trades can stay open for months.
- OAuth token store is a local file: fine on the owner's machine, not safe for a hosted deploy as is.
- Daily bars only. Up to 40 symbols per scan.
- Robinhood sign in was built without live testing; verify the full OAuth round trip first if it misbehaves.

## Roadmap (rough priority)

1. Options view: per contract P/L, days to expiry, breakeven distance, exit rule flags (+50% sell half,
   +100% sell rest, -60% review, under 30 days review) and the stock price targets for +50% / +100%
   (Black-Scholes using the contract's IV).
2. Smarter exits in the backtest (RSI back above 50, trailing stop, time stop) and per setup stats.
3. Export the daily top signals as JSON/markdown for a morning brief or phone notification.
4. News watcher on holdings: headline → affected positions → what the rules say (streaming news API + push).
5. Trade journal: log trades with setup type and thesis, monthly review vs holding QQQ.
6. Intraday bars for short dated plays; hosted deploy with real auth.
