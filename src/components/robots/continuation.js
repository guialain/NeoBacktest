// ============================================================================
// continuation.js — H1 CONTINUATION STRATEGY (NEO MATRIX PRO CLEAN)
// - Structure-safe version
// - abs(slope_h1) filter enforced
// - Compatible TopOpportunities router
// - Compatible SignalFilters
// ============================================================================

import { getSignalConfig } from "../config/MultipliersConfig";
import { detectContinuationPhase } from "./SignalPhaseDetector";

const ContinuationStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  function getCfg(symbol) {
    const assetCfg = getSignalConfig(symbol);
    return assetCfg?.h1Continuation ?? {};
  }

  const PHASE_BONUS = {
    EXPANSION_ACCELERATING: 40,
    EXPANSION:              20,
    EARLY_TREND:            15,
    MATURE_CONTINUATION:     5,
  };


  // =========================================================
  // BUY DETECTION
  // =========================================================

  function detectBuy(row, cfg) {

    const slope_h1  = num(row?.slope_h1);
    const dslope_h1 = num(row?.dslope_h1);
    const rsi_h1    = num(row?.rsi_h1);
    const zscore_h1 = num(row?.zscore_h1);
    const dz_h1     = num(row?.dz_h1);

    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null)
      return null;

    // ✅ STRUCTURE FILTER — CRITICAL
    if (Math.abs(slope_h1) < (cfg.slopeH1MinAbs ?? 1.25))
      return null;

    const phase = detectContinuationPhase(
      slope_h1,
      dslope_h1,
      "BUY",
      cfg
    );

    if (!phase)
      return null;

    // anti spike
    if (Math.abs(dslope_h1) > cfg.dslopeH1MaxAbs)
      return null;

    // RSI zone continuation
    if (rsi_h1 < (cfg.rsiContMin ?? 35) ||
        rsi_h1 > (cfg.rsiContMax ?? 65))
      return null;

    // BB structure
    if (zscore_h1 !== null && zscore_h1 < cfg.zscoreH1BuyMin)
      return null;

    if (zscore_h1 !== null && zscore_h1 > cfg.zscoreH1BuyMax)
      return null;

    if (dz_h1 !== null && dz_h1 > cfg.dzH1BuyMax)
      return null;

    if (
      zscore_h1 !== null &&
      dz_h1 !== null &&
      zscore_h1 < cfg.zscoreH1BuyMax &&
      dz_h1 < cfg.dzH1RepliMin
    )
      return null;

    return phase;

  }


  // =========================================================
  // SELL DETECTION
  // =========================================================

  function detectSell(row, cfg) {

    const slope_h1  = num(row?.slope_h1);
    const dslope_h1 = num(row?.dslope_h1);
    const rsi_h1    = num(row?.rsi_h1);
    const zscore_h1 = num(row?.zscore_h1);
    const dz_h1     = num(row?.dz_h1);

    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null)
      return null;

    // ✅ STRUCTURE FILTER — CRITICAL
    if (Math.abs(slope_h1) < (cfg.slopeH1MinAbs ?? 1.25))
      return null;

    const phase = detectContinuationPhase(
      slope_h1,
      dslope_h1,
      "SELL",
      cfg
    );

    if (!phase)
      return null;

    // anti spike
    if (Math.abs(dslope_h1) > cfg.dslopeH1MaxAbs)
      return null;

    // RSI zone continuation
    if (rsi_h1 < (cfg.rsiContMin ?? 35) ||
        rsi_h1 > (cfg.rsiContMax ?? 65))
      return null;

    // BB structure
    if (zscore_h1 !== null && zscore_h1 > cfg.zscoreH1SellMax)
      return null;

    if (zscore_h1 !== null && zscore_h1 < cfg.zscoreH1SellMin)
      return null;

    if (dz_h1 !== null && dz_h1 < cfg.dzH1SellMin)
      return null;

    if (
      zscore_h1 !== null &&
      dz_h1 !== null &&
      zscore_h1 > cfg.zscoreH1SellMin &&
      dz_h1 > -cfg.dzH1RepliMin
    )
      return null;

    return phase;

  }



  // =========================================================
  // SCORE
  // =========================================================

  function computeScore(row, phase) {

    const slope = Math.abs(num(row?.slope_h1) ?? 0);
    const rsi   = num(row?.rsi_h1) ?? 50;
    const bonus = PHASE_BONUS[phase] ?? 0;

    return Math.max(
      0,
      Math.round(
        slope * 50 +
        Math.abs(rsi - 50) * 2 +
        bonus
      )
    );

  }



  // =========================================================
  // MAIN
  // =========================================================

  function evaluate(marketData = [], opts = {}) {

    if (!Array.isArray(marketData) || !marketData.length)
      return [];

    const symbol = marketData[0]?.symbol;

    if (!symbol)
      return [];

    const cfg = getCfg(symbol);

    const scoreMin = num(opts.scoreMin) ?? 0;

    const opportunities = [];


    for (let i = 0; i < marketData.length; i++) {

      const row = marketData[i];

      const phaseBuy  = detectBuy(row, cfg);

      const phaseSell = phaseBuy
        ? null
        : detectSell(row, cfg);


      const phase = phaseBuy ?? phaseSell;

      if (!phase)
        continue;


      const side =
        phaseBuy
          ? "BUY"
          : "SELL";


      const score =
        computeScore(row, phase);


      if (score < scoreMin)
        continue;



      opportunities.push({

        type:   "CONTINUATION",
        regime: "CONTINUATION",

        index: i,

        timestamp: row.timestamp,

        symbol,

        side,

        signalType: side,
        signalPhase: phase,

        score,
        raw_score: score,


        rsi_h1: num(row?.rsi_h1),
        slope_h1: num(row?.slope_h1),
        dslope_h1: num(row?.dslope_h1),
        dz_h1: num(row?.dz_h1),

        atr_m15: num(row?.atr_m15),
        atr_h1: num(row?.atr_h1),
        close: num(row?.close),

        rsi_m1: num(row?.rsi_m1),
        slope_m1: num(row?.slope_m1),
        drsi_m1: num(row?.drsi_m1),
        dslope_m1: num(row?.dslope_m1),

        rsi_m5: num(row?.rsi_m5),
        slope_m5: num(row?.slope_m5),
        drsi_m5: num(row?.drsi_m5),
        dslope_m5: num(row?.dslope_m5),

      });

    }

    return opportunities;

  }


  return { evaluate };

})();


export default ContinuationStrategy;