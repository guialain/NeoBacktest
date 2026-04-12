import TopOpportunities from "../robots/TopOpportunities_V8R";
import SignalFilters from "../robots/SignalFilters_LAB";
import { simulateTrades } from "./tradeSimulator";
import { calculateStats } from "./statsCalculator";
import { getRiskConfig } from "../config/RiskConfig";

// ================================
// HELPERS
// ================================

function summarizeScores(opps) {
  const scores = opps
    .map(o => Number(o.raw_score ?? o.score))
    .filter(Number.isFinite);

  if (!scores.length) return { n: 0 };

  scores.sort((a, b) => a - b);

  const q = p => scores[Math.floor((scores.length - 1) * p)];

  return {
    n:   scores.length,
    min: q(0),
    q10: q(0.10),
    q25: q(0.25),
    q50: q(0.50),
    q75: q(0.75),
    q90: q(0.90),
    max: q(1)
  };
}

// ================================
// BACKTEST
// ================================

export async function runBacktest(config) {

  const finalConfig = {
    usedLeverageMax: 15,
    ...config
  };

  // 1️⃣ FETCH
  const response = await fetch(
    `http://localhost:3001/api/backtest/${finalConfig.fileName}`
  );

  if (!response.ok)
    throw new Error("Backtest API error");

  const json = await response.json();
  if (!json.rows)
    throw new Error("No CSV rows received from server");

  // 2️⃣ NORMALISATION — compatible ancien format (OHLC) et nouveau (neo_audit, s0)
  const filteredRows = json.rows
    .filter(r => {
      if (!finalConfig.periodStart || !finalConfig.periodEnd) return true;
      const [datePart] = r.timestamp.split(" ");
      const normalized = datePart.replace(/\./g, "-");
      return normalized >= finalConfig.periodStart &&
             normalized <= finalConfig.periodEnd;
    });

console.log("slope_h4_s0 sample:", filteredRows.slice(0,3).map(r => r.slope_h4_s0));
console.log("drsi_h1_s0 sample:", filteredRows.slice(0,3).map(r => r.drsi_h1_s0));


  const N = v => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

  const marketData = filteredRows.map((r, index) => {
    const symbol = r.symbol;
    const riskCfg = getRiskConfig(symbol);

    // Prix — nouveau format: price/close_m5, ancien: open/high/low/close
    const hasOHLC = r.open !== undefined && r.open !== null;
    const closePrice = hasOHLC ? N(r.close) : N(r.close_m5 ?? r.price);
    const openPrice  = hasOHLC ? N(r.open) : closePrice; // sera corrigé après le map
    const highPrice  = hasOHLC ? N(r.high) : closePrice;
    const lowPrice   = hasOHLC ? N(r.low)  : closePrice;

    // tick_size from CSV, contract_size from RiskConfig
    const tickSize     = N(r.tick_size) || 0;
    const contractSize = N(r.contract_size) || N(riskCfg.contractSize) || 0;
    const baseToEUR    = N(riskCfg.baseToEUR) || 1;

    // tick_value: CSV si dispo, sinon calculé
    // FX: nominal/lot = contractSize × baseToEUR → tickValue = contractSize × baseToEUR × tickSize / price
    // Non-FX: nominal/lot = contractSize × price × baseToEUR → tickValue = contractSize × baseToEUR × tickSize
    let tickValue = N(r.tick_value);
    if (!Number.isFinite(tickValue) || tickValue <= 0) {
      const isFX = (r.assetclass === "FX");
      if (isFX && closePrice > 0) {
        tickValue = contractSize * baseToEUR * tickSize / closePrice;
      } else {
        tickValue = contractSize * baseToEUR * tickSize;
      }
    }

    // Spread — nouveau: "spread" colonne, ancien: spread_price/spread_points
    const spreadPrice = N(r.spread_price) || N(r.spread) || N(riskCfg.spread) || 0;

    return {
      index,
      symbol,
      timestamp: r.timestamp,

      open:  openPrice,
      high:  highPrice,
      low:   lowPrice,
      close: closePrice,

      // --- M5 s1
      rsi_m5:    N(r.rsi_m5),
      slope_m5:  N(r.slope_m5),
      zscore_m5: N(r.zscore_m5),
      dslope_m5: N(r.dslope_m5),
      drsi_m5:   N(r.drsi_m5),
      dz_m5:     N(r.dz_m5),

      // --- M5 s0
      rsi_m5_s0:    N(r.rsi_m5_s0),
      slope_m5_s0:  N(r.slope_m5_s0),
      drsi_m5_s0:   N(r.drsi_m5_s0),
      zscore_m5_s0: N(r.zscore_m5_s0),

      // --- M15 s1
      rsi_m15:    N(r.rsi_m15),
      slope_m15:  N(r.slope_m15),
      dslope_m15: N(r.dslope_m15),
      drsi_m15:   N(r.drsi_m15),
      zscore_m15: N(r.zscore_m15),
      dz_m15:     N(r.dz_m15),

      // --- M15 s0
      rsi_m15_s0:    N(r.rsi_m15_s0),
      slope_m15_s0:  N(r.slope_m15_s0),
      drsi_m15_s0:   N(r.drsi_m15_s0),
      zscore_m15_s0: N(r.zscore_m15_s0),

      // --- H1 s1
      rsi_h1:    N(r.rsi_h1),
      slope_h1:  N(r.slope_h1),
      dslope_h1: N(r.dslope_h1),
      zscore_h1: N(r.zscore_h1),
      dz_h1:     N(r.dz_h1),
      drsi_h1:   N(r.drsi_h1),
      atr_h1:    N(r.atr_h1),
      zscore_h1_min3: N(r.zscore_h1_min3),
      zscore_h1_max3: N(r.zscore_h1_max3),
      rsi_h1_previouslow3:  N(r.rsi_h1_previouslow3),
      rsi_h1_previoushigh3: N(r.rsi_h1_previoushigh3),

      // --- H1 s0
      rsi_h1_s0:    N(r.rsi_h1_s0),
      slope_h1_s0:  N(r.slope_h1_s0),
      drsi_h1_s0:   N(r.drsi_h1_s0),
      zscore_h1_s0: N(r.zscore_h1_s0),

      // --- H4 s1
      rsi_h4:    N(r.rsi_h4),
      slope_h4:  N(r.slope_h4),
      dslope_h4: N(r.dslope_h4),
      zscore_h4: N(r.zscore_h4),
      dz_h4:     N(r.dz_h4),
      drsi_h4:   N(r.drsi_h4),

      // --- H4 s0
      rsi_h4_s0:    N(r.rsi_h4_s0),
      slope_h4_s0:  N(r.slope_h4_s0),
      drsi_h4_s0:   N(r.drsi_h4_s0),
      zscore_h4_s0: N(r.zscore_h4_s0),

      // --- ATR
      atr_m5:  N(r.atr_m5),
      atr_m15: N(r.atr_m15),
      atr_h4:  N(r.atr_h4),
      atr_d1:  N(r.atr_d1),

      // --- Range M5 (ancien format)
      range_m5_s1: N(r.range_m5_s1),
      range_m5_s2: N(r.range_m5_s2),

      // --- Contrat
      tick_size:     tickSize,
      tick_value:    tickValue,
      contract_size: contractSize,

      intraday_change: N(r.intraday_change),
      spread_price:    spreadPrice,
    };
  });

  // Nouveau format sans OHLC: dériver open=prev close, high/low=max/min(open,close)
  if (filteredRows.length > 0 && filteredRows[0].open === undefined) {
    for (let i = 1; i < marketData.length; i++) {
      const prevClose = marketData[i - 1].close;
      if (Number.isFinite(prevClose)) {
        marketData[i].open = prevClose;
        marketData[i].high = Math.max(prevClose, marketData[i].close);
        marketData[i].low  = Math.min(prevClose, marketData[i].close);
      }
    }
  }

  console.log("symbol check:", marketData[0]?.symbol, "rows:", marketData.length);


  // 3️⃣ SIGNAL DETECTION
const opportunities = TopOpportunities.evaluate(marketData, { debug: true, scoreMin: 0 });


  // 4️⃣ FILTRE M5
  const filtered  = SignalFilters.evaluate({ opportunities });
  const validOpps = filtered.validOpportunities ?? [];

  const waitOpps = filtered.waitOpportunities ?? [];
  // 5️⃣ SIMULATION
  const simResult = simulateTrades(marketData, validOpps, finalConfig);
  const trades    = simResult.trades ?? [];

  // 6️⃣ STATS
  const stats = calculateStats(trades, finalConfig);

  // 7️⃣ ROUTE BREAKDOWN
  const byRoute = {};
  for (const t of trades) {
    const r = t.route ?? "unknown";
    if (!byRoute[r]) byRoute[r] = { wins: 0, losses: 0, grossW: 0, grossL: 0 };
    if (t.pnl >= 0) { byRoute[r].wins++; byRoute[r].grossW += t.pnl; }
    else            { byRoute[r].losses++; byRoute[r].grossL += Math.abs(t.pnl); }
  }
  const routeTable = Object.entries(byRoute)
    .map(([route, d]) => {
      const total = d.wins + d.losses;
      const wr = total ? (d.wins / total * 100).toFixed(1) : "—";
      const pf = d.grossL > 0 ? (d.grossW / d.grossL).toFixed(2) : "∞";
      return { route, trades: total, WR: wr + "%", PF: pf };
    })
    .sort((a, b) => b.trades - a.trades);
  console.table(routeTable);

  return { trades, stats };
}