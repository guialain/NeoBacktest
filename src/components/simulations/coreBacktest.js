import TopOpportunities from "../robots/TopOpportunities";
import SignalFilters from "../robots/SignalFilters";
import { simulateTrades } from "./tradeSimulator";
import { calculateStats } from "./statsCalculator";

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

  // 2️⃣ NORMALISATION
  const marketData = json.rows
    .filter(r => {
      if (!finalConfig.periodStart || !finalConfig.periodEnd) return true;
      const [datePart] = r.timestamp.split(" ");
      const normalized = datePart.replace(/\./g, "-");
      return normalized >= finalConfig.periodStart &&
             normalized <= finalConfig.periodEnd;
    })
    .map((r, index) => ({
      index,
      symbol:    r.symbol,
      timestamp: r.timestamp,

      open:  Number(r.open),
      high:  Number(r.high),
      low:   Number(r.low),
      close: Number(r.close),

      // --- M1
      rsi_m1:    Number(r.rsi_m1),
      slope_m1:  Number(r.slope_m1),
      zscore_m1: Number(r.zscore_m1),
      drsi_m1:   Number(r.drsi_m1),
      dslope_m1: Number(r.dslope_m1),
      dz_m1:     Number(r.dz_m1),
      atr_m1:    Number(r.atr_m1),
      datr_m1:   Number(r.datr_m1),

   // --- M5
rsi_m5:    Number(r.rsi_m5),
slope_m5:  Number(r.slope_m5),
zscore_m5: Number(r.zscore_m5),  // ✅ ajout
dslope_m5: Number(r.dslope_m5),
drsi_m5:   Number(r.drsi_m5),
dz_m5:     Number(r.dz_m5),      // ✅ ajout

      // --- M15
      rsi_m15:    Number(r.rsi_m15),
      slope_m15:  Number(r.slope_m15),
      dslope_m15: Number(r.dslope_m15),
      drsi_m15:   Number(r.drsi_m15),

      // --- H1
      rsi_h1:    Number(r.rsi_h1),
      slope_h1:  Number(r.slope_h1),
      dslope_h1: Number(r.dslope_h1),
      zscore_h1: Number(r.zscore_h1),  // ✅ requis par TopOpportunities (dbbz)
      dz_h1:     Number(r.dz_h1),      // ✅ requis par TopOpportunities (dbbz)
      drsi_h1:   Number(r.drsi_h1),

      // --- H4
      slope_h4: Number(r.slope_h4),

      // --- ATR
      atr_m5:  Number(r.atr_m5),
      atr_m15: Number(r.atr_m15),
      atr_h1:  Number(r.atr_h1),
      atr_h4:  Number(r.atr_h4),
      atr_d1:  Number(r.atr_d1),

      // --- Contrat
      tick_size:     Number(r.tick_size),
      tick_value:    Number(r.tick_value),
      contract_size: Number(r.contract_size),

      intraday_change: Number(r.intraday_change),
      spread_points:   Number(r.spread_points),
    }));

console.log("symbol check:", marketData[0]?.symbol, json.rows[0]?.symbol);


  // 3️⃣ SIGNAL H1
  const opportunities = TopOpportunities.evaluate(marketData);

  

  // 4️⃣ FILTRE M5
  const filtered  = SignalFilters.evaluate({ opportunities });
  const validOpps = filtered.validOpportunities ?? [];

  // 🔍 DIAGNOSTIC FILTRE
  const stateCounts = {};
  for (const o of filtered.waitOpportunities ?? []) {
    stateCounts[o.state] = (stateCounts[o.state] ?? 0) + 1;
  }
  console.info("🔍 FILTER REPORT", { valid: validOpps.length, blocked: stateCounts });

  // 5️⃣ SIMULATION
  const simResult = simulateTrades(marketData, validOpps, finalConfig);
  const trades    = simResult.trades ?? [];

  // 6️⃣ STATS
  const stats = calculateStats(trades, finalConfig);

  return { trades, stats };
}