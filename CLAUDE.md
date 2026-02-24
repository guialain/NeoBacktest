# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

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

**Note:** `vite.config.js` proxies `/api` to `http://localhost:3005`, but `server.js` listens on port **3001**. This is a mismatch — if API calls fail, check/fix this port discrepancy.

There are no test or lint scripts defined.

## Architecture

### Data Flow

```
MetaTrader 5 CSV files → Express backend (server.js)
    → coreBacktest.js (orchestrator)
        → TopOpportunities.js (H1 reversal signal generation)
        → SignalFilters.js (M5 signal confirmation)
        → tradeSimulator.js (trade execution + PnL)
        → statsCalculator.js (performance metrics)
    → React UI (Parameters → Results + Performance)
```

### Backend (server.js)

Express server that reads semicolon-delimited CSV files from a **hardcoded MetaTrader 5 path**:
`C:/Users/DELL/AppData/Roaming/MetaQuotes/Terminal/9B101088254A9C260A9790D5079A7B11/MQL5/Files`

Key endpoints:
- `GET /api/backtest-files` — list available CSV files
- `GET /api/backtest-meta/:fileName` — symbol, period, row count
- `GET /api/backtest/:fileName` — paginated OHLCV market data

CSV format: semicolon-delimited, date in `DD.MM.YYYY HH:MM` format.

### Signal Generation (`src/components/robots/`)

- **TopOpportunities.js** — Detects H1 reversals using RSI extremes (BUY: RSI < 25, SELL: RSI > 75), Bollinger Band derivatives (`dz_h1`), and slope dynamics
- **SignalFilters.js** — Filters signals using M5 bar data for confirmation

### Trade Simulation (`src/components/simulations/`)

- **coreBacktest.js** — Orchestrates the full backtest: fetches data, normalizes timestamps, generates signals, runs simulation
- **tradeSimulator.js** — Multi-trade portfolio engine with: volume-based position sizing (0.001–0.1 lots), leverage cap, minimum trade spacing, TP/SL exits, spread modeling
- **statsCalculator.js** — Computes equity curve, win rate, drawdown, profit factor, expectancy, Sharpe ratio

### Asset Configuration (`src/components/config/`)

- **AssetConfig.js** — Per-symbol trading parameters (TP/SL %, RSI windows, ATR thresholds, slope limits). Currently configured for EURUSD. New symbols need entries here.
- **PortfolioConfig.js** — Global portfolio settings (initial equity, max open trades, leverage cap)

### Key Trading Parameters (EURUSD defaults)

- Initial equity: 10,000
- TP: ~0.07%, SL: ~0.15%
- Max open trades: 3–10 (configurable)
- Leverage cap: 30× (configurable)

## Tech Stack

- **Frontend:** React 18 + Vite 5, TailwindCSS, Recharts (charts)
- **Backend:** Express 5, Node.js ES modules (`"type": "module"`)
- **Data:** CSV parsing, custom technical indicators (RSI, ATR, slopes)
