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

      // --- M15 zscore
      zscore_m15: Number(r.zscore_m15),
      dz_m15:     Number(r.dz_m15),

      // --- H1
      rsi_h1:    Number(r.rsi_h1),
      slope_h1:  Number(r.slope_h1),
      dslope_h1: Number(r.dslope_h1),
      zscore_h1: Number(r.zscore_h1),
      dz_h1:     Number(r.dz_h1),
      drsi_h1:   Number(r.drsi_h1),
      zscore_h1_min3: Number(r.zscore_h1_min3),
      zscore_h1_max3: Number(r.zscore_h1_max3),
      rsi_h1_previouslow3:  Number(r.rsi_h1_previouslow3),
      rsi_h1_previoushigh3: Number(r.rsi_h1_previoushigh3),

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

  console.log("Opportunities breakdown:",
    opportunities.reduce((acc, o) => {
      const key = o.type + "_" + o.signalType;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  );

  // 4️⃣ FILTRE M5
  const filtered  = SignalFilters.evaluate({ opportunities });
  const validOpps = filtered.validOpportunities ?? [];

  const waitOpps = filtered.waitOpportunities ?? [];
  console.info("SIGNAL FILTERS REPORT", {
    input:              opportunities.length,
    valid:              validOpps.length,
    wait:               waitOpps.length,
    wait_hours:         waitOpps.filter(o => o.state === "WAIT_OUTSIDE_HOURS").length,
    wait_weekend:       waitOpps.filter(o => o.state === "WAIT_WEEKEND").length,
    wait_volatility:    waitOpps.filter(o => o.state?.includes("WAIT_VOL")).length,
    wait_m5_contrary:   waitOpps.filter(o => o.state === "WAIT_M5_CONTRARY").length,
    wait_m5_confirm:    waitOpps.filter(o => o.state === "WAIT_M5_CONFIRMATION").length,
    wait_m5_overext:    waitOpps.filter(o => o.state === "WAIT_M5_OVEREXTENDED").length,
    wait_m1:            waitOpps.filter(o => o.state === "WAIT_M1_CONTRARY").length,
    wait_zm5:           waitOpps.filter(o => o.state === "WAIT_ZM5_EXTENDED").length,
  });

  // 5️⃣ SIMULATION
  const simResult = simulateTrades(marketData, validOpps, finalConfig);
  const trades    = simResult.trades ?? [];

  console.log("Trades breakdown:",
    trades.reduce((acc, t) => {
      const key = t.type + "_" + t.signalType;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  );

  console.log("First trade sample:", JSON.stringify(trades[0], null, 2));

  // 6️⃣ STATS
  const stats = calculateStats(trades, finalConfig);

  return { trades, stats };
}