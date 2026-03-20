# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Neo-Backtest is a financial trading backtesting platform for algorithmic strategy validation, focused on forex/index trading with multi-timeframe technical analysis.

## Development Commands

```bash
# Run both frontend (port 5173) and backend (port 3001) concurrently
npm run dev:full

# Run only the Vite frontend dev server
npm run dev

# Run only the Express backend
npm run server
```

**Port mismatch warning:** `vite.config.js` proxies `/api` to `http://localhost:3005`, but `server.js` listens on **3001**. `coreBacktest.js` calls `http://localhost:3001` directly (bypassing the proxy). Fix `vite.config.js` if proxy-based routing is needed.

There are no test or lint scripts defined.

## Architecture

### Data Flow

```
MetaTrader 5 CSV files → Express backend (server.js)
    → coreBacktest.js (orchestrator)
        → TopOpportunities.js (delegates to reversal.js + continuation.js)
            → reversal.js    (H1 RSI extremes + BB derivatives → BUY/SELL/BUY_EARLY/SELL_EARLY)
            → continuation.js (H1 established trend + M5 momentum alignment → BUY/SELL)
        → SignalFilters.js (post-signal veto filters, behavior differs by signal type)
        → tradeSimulator.js (trade execution + PnL, compound equity scaling)
        → statsCalculator.js (performance metrics)
    → React UI (Parameters → Results + Performance)
```

### Backend (`server.js`)

Express server reading semicolon-delimited CSV from a hardcoded MetaTrader 5 path:
`C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files/backtest`

Key endpoints:
- `GET /api/backtest-files` — list available CSV files
- `GET /api/backtest-meta/:fileName` — symbol, period, row count
- `GET /api/backtest/:fileName` — full OHLCV + indicator data (paginated)

CSV format: semicolon-delimited, date in `DD.MM.YYYY HH:MM` format.

### Signal Generation (`src/components/robots/`)

**`TopOpportunities.js`** — thin orchestrator. Merges and sorts by index:
```js
[...ReversalStrategy.evaluate(marketData), ...ContinuationStrategy.evaluate(marketData)]
```

**`reversal.js`** — H1 reversal engine:
- BUY: `minRSI_h1 < rsiBuyMax` (default 27) + `dz_h1 > dbbzBuyMin`
- SELL: `maxRSI_h1 > rsiSellMin` (default 73) + `dz_h1 < dbbzSellMax`
- `_EARLY` variant fires when `slope_h1` flips direction (flip confirmation)
- Reads: `rsi_h1`, `slope_h1`, `dslope_h1`, `dz_h1` (Bollinger Band derivative)

**`continuation.js`** — H1 trend continuation engine:
- BUY: `slope_h1 ≥ slopeH1Min` + `rsi_h1 ∈ [rsiBuyMin, rsiBuyMax]` + `slope_m5 > 0` + `dslope_m5 > 0.05`
- SELL: symmetric
- Reads: `slope_h1`, `dslope_h1`, `rsi_h1`, `rsi_m5`, `slope_m5`, `dslope_m5`, `zscore_h1`, `dz_h1`

Both strategies emit `{ type, index, timestamp, symbol, side, signalType, regime, score, raw_score, ...indicator fields }`.

### Signal Filtering (`src/components/robots/SignalFilters.js`)

Applied **after** signal generation. Filters differ by `opp.type`:

**Common filters (all types):**
1. `WAIT_WEEKEND` — no entries Friday ≥ 15h, Saturday, Sunday
2. `WAIT_LOW_VOL` — `ATR_M15/close` outside `[minRatio, maxRatio]` from `AssetConfig.volatility`

**Reversal-only filters:**
3. `WAIT_MICRO` — M5 contrary (slope, dslope, drsi, rsi checks)
4. `WAIT_M5_OVEREXTENDED` — M5 spike in trade direction
5. `WAIT_STALE_RSI` — `rsi_h1` moved too far from extreme zone (`rsiStalenessMargin`)
6. `WAIT_H1_EXTREME` — `|slope_h1| > slopeH1MaxAbs`
7. `WAIT_H1_SLOPE` — `slope_h1` not yet in trade direction (`slopeH1BuyMin`/`slopeH1SellMax`)
8. `WAIT_H1_OVEREXTENDED` — `|dslope_h1| > 4.0`
9. `WAIT_H1_MOMENTUM` — `dslope_h1` against signal direction
10. `WAIT_WEAK_M5` — `|slope_m5|` or `|dslope_m5| < 0.01`

**Continuation-only filter:**
- `WAIT_M5_OVEREXTENDED` only (M5 alignment already enforced during detection)

### Trade Simulation (`src/components/simulations/tradeSimulator.js`)

- Entry on bar open (next bar after signal)
- Spread applied at entry: `spreadPoints × tickSize` (or config override)
- TP/SL: percentage from `AssetConfig.tpPct` / `AssetConfig.slPct`
- Position sizing: compound-scaling — `size = (equity × targetLeveragePerTrade) / (contractSize × baseToEUR)`
- Portfolio leverage cap: `USED_LEVERAGE_MAX` (default 15, from `config.usedLeverageMax`)
- Loss cooldown: 15 min after a losing open trade before new entry
- `FORCED_CLOSE` on last bar for unclosed trades
- Detailed `console.warn` logs on every loss for debugging

### Asset Configuration (`src/components/config/`)

**`AssetConfig.js`** — per-symbol config. Configured symbols: `EURUSD`, `GBPUSD`, `USDJPY`, `EURJPY`, `GBPJPY`, `EURGBP`. Each entry has:
- `tpPct`, `slPct`, `targetLeveragePerTrade`, `contractSize`, `refPrice`, `baseToEUR`
- `volatility`: `{ minRatio, maxRatio }` — ATR_M15/close bounds
- `h1Reversal`: RSI thresholds, slope/dslope/dbbz conditions, staleness margin
- `h1Continuation`: RSI zones for continuation entries
- `h1SlopeClass`: slope classification bands (flat / up_weak / up_strong / up_extreme / down_*)
- `dailyMultiplier` / `h4Multiplier`: score multiplier tables (declared, not yet consumed by simulator)

Use `getAssetConfig(symbol)` — normalizes symbol to uppercase, falls back to `default`.

**`PortfolioConfig.js`** — global: `maxUsedLeverage`, `maxOpenTrades`, `maxExposurePerAsset`. Currently not imported by the simulator (simulator reads from `config` passed at runtime).

### Market Data Fields Expected by `coreBacktest.js`

Each row after normalization must carry: `open`, `high`, `low`, `close`, `symbol`, `timestamp`, `index`, plus indicators: `rsi_m5`, `slope_m5`, `dslope_m5`, `drsi_m5`, `rsi_m15`, `slope_m15`, `dslope_m15`, `drsi_m15`, `rsi_h1`, `slope_h1`, `dslope_h1`, `zscore_h1`, `dz_h1`, `drsi_h1`, `slope_h4`, `atr_m5`, `atr_m15`, `atr_h1`, `atr_h4`, `atr_d1`, `tick_size`, `tick_value`, `contract_size`, `intraday_change`, `spread_points`.

## Tech Stack

- **Frontend:** React 18 + Vite 5, TailwindCSS, Recharts (charts)
- **Backend:** Express 5, Node.js ES modules (`"type": "module"`)
- **Data:** CSV parsing, custom technical indicators computed in MetaTrader 5 and exported
