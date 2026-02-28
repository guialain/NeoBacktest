// ============================================================================
// reversal.js — H1 REVERSAL STRATEGY (FIXED PRODUCTION VERSION)
// - Compatible TopOpportunities RSI Router (index numeric + regime added)
// - Logging gated by opts.debug
// ============================================================================

import { getSignalConfig } from "../config/MultipliersConfig";
import { detectReversalPhase } from "./SignalPhaseDetector";

const ReversalStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // CONFIG VALIDATION
  // ============================================================================
  function isValidCfg(cfg) {
    if (!cfg) return false;

    const required = [
      "rsiWindowH1",
      "rsiBuyMax",
      "rsiSellMin",
      "flipSlopeMin",
      "flipDslopeMin",
      "dbbzBuyMin",
      "dbbzSellMax"
    ];

    return required.every(k => Number.isFinite(Number(cfg[k])));
  }

  // ============================================================================
  // RSI WINDOW H1
  // ============================================================================
  function getMinMaxRSI_H1(rows, i, bars = 5) {
    let count = 0;
    let min = Infinity;
    let max = -Infinity;
    let current = null;
    let lastHour = null;

    for (let k = i; k >= 0; k--) {
      const ts = rows[k]?.timestamp;
      const hour = ts?.slice(0, 13);
      if (!hour) continue;
      if (hour === lastHour) continue;

      lastHour = hour;

      const rsi = num(rows[k]?.rsi_h1);
      if (rsi === null) return null;

      if (current === null) current = rsi;

      if (rsi < min) min = rsi;
      if (rsi > max) max = rsi;

      count++;
      if (count >= bars) break;
    }

    if (count < bars) return null;

    return {
      minRSI: min,
      maxRSI: max,
      currentRSI: current
    };
  }

  // ============================================================================
  // H1 DYNAMICS
  // ============================================================================
  function getH1Dynamics(row) {
    const slope = num(row?.slope_h1);
    const dslope = num(row?.dslope_h1);
    const dbbz = num(row?.dz_h1);
const zscore = num(row?.zscore_h1);


    if (slope === null || dslope === null || dbbz === null) return null;

    return { slope, dslope, dbbz,zscore };
  }

  // ============================================================================
  // STRUCTURE GATE (FIXED)
  // ============================================================================
  function passesStructureGate(side, rsiStats, dyn, cfg) {
    const rsi = num(rsiStats?.currentRSI);
    const slope = num(dyn?.slope);
    const dslope = num(dyn?.dslope);

    if (rsi === null || slope === null || dslope === null) return false;

    const slopeMin = cfg.slopeH1Min ?? 1.25;
    const dslopeMin = cfg.dslopeH1ReversalMin ?? 0.5;

    // BUY REVERSAL
    if (side === "BUY") {
      const deep = cfg.rsiBuyMax ?? 30;
      const semi = cfg.rsiBuySemi ?? 35;

      if (rsi < deep) return slope >= -slopeMin && dslope > dslopeMin;
      if (rsi < semi) return slope >= slopeMin && dslope > dslopeMin;
      return false;
    }

    // SELL REVERSAL
    if (side === "SELL") {
      const deep = cfg.rsiSellMin ?? 70;
      const semi = cfg.rsiSellSemi ?? 65;

      if (rsi > deep) return slope <= slopeMin && dslope < -dslopeMin;
      if (rsi > semi) return slope <= -slopeMin && dslope < -dslopeMin;
      return false;
    }

    return false;
  }

  // ============================================================================
  // EARLY DETECTION
  // ============================================================================
  function isEarlyBuyConfirmed(dyn, cfg) {
    const slope1 = dyn.slope - dyn.dslope;
    return (
      slope1 < 0 &&
      dyn.slope > 0 &&
      Math.abs(dyn.slope) >= cfg.flipSlopeMin &&
      Math.abs(dyn.dslope) >= cfg.flipDslopeMin
    );
  }

  function isEarlySellConfirmed(dyn, cfg) {
    const slope1 = dyn.slope - dyn.dslope;
    return (
      slope1 > 0 &&
      dyn.slope < 0 &&
      Math.abs(dyn.slope) >= cfg.flipSlopeMin &&
      Math.abs(dyn.dslope) >= cfg.flipDslopeMin
    );
  }

  // ============================================================================
  // RSI PATH
  // ============================================================================
  function detectBuy(rsiStats, dyn, cfg) {
    if (rsiStats.minRSI > cfg.rsiBuyMax) return null;

// bloque BUY si pas assez bas dans les bandes
const z = num(dyn?.zscore);

if (z === null || z > -1.5)
return null;


    if (dyn.dbbz < cfg.dbbzBuyMin) return null;

    return isEarlyBuyConfirmed(dyn, cfg) ? "BUY_EARLY" : "BUY";
  }

  function detectSell(rsiStats, dyn, cfg) {
    if (rsiStats.maxRSI < cfg.rsiSellMin) return null;

    // bloque SELL si pas assez haut dans les bandes
    const z = num(dyn?.zscore);
if (z === null || z < 1.5)
return null;


    if (dyn.dbbz > cfg.dbbzSellMax) return null;

    return isEarlySellConfirmed(dyn, cfg) ? "SELL_EARLY" : "SELL";
  }

  // ============================================================================
  // PHASE PATH
  // ============================================================================
  function detectBuyPhase(dyn, cfg) {
    const p = detectReversalPhase(dyn.slope, dyn.dslope, "BUY", cfg);
    return p ? `BUY_${p}` : null;
  }

  function detectSellPhase(dyn, cfg) {
    const p = detectReversalPhase(dyn.slope, dyn.dslope, "SELL", cfg);
    return p ? `SELL_${p}` : null;
  }

  // ============================================================================
  // SCORE
  // ============================================================================
  function computeScore(rsiStats, dyn, signalType, cfg) {
    let score = 0;

    if (signalType.includes("BUY"))
      score += Math.round((cfg.rsiBuyMax - rsiStats.minRSI) * 2);
    else
      score += Math.round((rsiStats.maxRSI - cfg.rsiSellMin) * 2);

    score += Math.round(Math.abs(dyn.dslope) * 100);
    score += Math.round(Math.abs(dyn.dbbz) * 50);

    if (signalType.includes("EARLY"))
      score += cfg.earlyScoreBonus ?? 20;

    return Math.max(score, 0);
  }

  // ============================================================================
  // MAIN EVALUATE
  // ============================================================================
  function evaluate(rows = [], opts = {}) {
    const data = Array.isArray(rows) ? rows : [];
    if (!data.length) return [];

    const symbol = data[0]?.symbol;
    if (!symbol) return [];

    const cfg = getSignalConfig(symbol)?.h1Reversal;
    if (!isValidCfg(cfg)) return [];

    const scoreMin = num(opts.scoreMin) ?? 0;
    const debug = Boolean(opts.debug);

    const opps = [];

    const d = {
      total: 0,
      structureFiltered: 0,
      scoreFiltered: 0,
      signals: 0
    };

    for (let i = 0; i < data.length; i++) {
      d.total++;

      const rsiStats = getMinMaxRSI_H1(data, i, cfg.rsiWindowH1);
      if (!rsiStats) continue;

      const dyn = getH1Dynamics(data[i]);
      if (!dyn) continue;

      const signalType =
        detectBuy(rsiStats, dyn, cfg) ??
        detectSell(rsiStats, dyn, cfg) ??
        detectBuyPhase(dyn, cfg) ??
        detectSellPhase(dyn, cfg);

      if (!signalType) continue;

      const side = signalType.startsWith("BUY") ? "BUY" : "SELL";

      if (!passesStructureGate(side, rsiStats, dyn, cfg)) {
        d.structureFiltered++;
        continue;
      }

      const score = computeScore(rsiStats, dyn, signalType, cfg);

      if (score < scoreMin) {
        d.scoreFiltered++;
        continue;
      }

      d.signals++;

      // ✅ TopOpp uses: index, timestamp, symbol, side, type, signalPhase(optional), regime(optional)
      // We provide regime for dedupe + downstream clarity
      const regime = side === "BUY" ? "REVERSAL_BUY" : "REVERSAL_SELL";

      opps.push({
        type: "REVERSAL",           // ✅ normalized (avoid "reversal" vs "REVERSAL" split)
        regime,                     // ✅ used in TopOpp makeKey()
        index: i,                   // ✅ mandatory for routing
        timestamp: data[i]?.timestamp,
        symbol,
        side,
        signalType,
        score,

        // payload (kept as-is)
        rsi_h1: rsiStats.currentRSI,
        slope_h1: dyn.slope,
        dslope_h1: dyn.dslope,
        dz_h1: dyn.dbbz
      });
    }

    if (debug) console.info("REVERSAL REPORT", d);

    return opps;
  }

  return { evaluate };

})();

export default ReversalStrategy;