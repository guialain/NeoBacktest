// ============================================================================
// reversal.js — H1 REVERSAL STRATEGY
// Deux chemins de détection :
//   1. RSI extrêmes (BUY / BUY_EARLY / SELL / SELL_EARLY) — inchangé
//   2. Phase-based (BUY_REVERSAL_START / CLIMAX_SLOWING / MATURE_END / EXPANSION_END)
//      Phases valides : tendance établie + flex dans le sens opposé
//      Bloqués : FLAT | EXPANSION_SLOWING | MATURE_SLOWING | CLIMAX_RUN
// ============================================================================

import { getSignalConfig } from "../config/MultipliersConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";
import { detectReversalPhase } from "./SignalPhaseDetector";

const ReversalStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  function isValidCfg(cfg) {
    if (!cfg) return false;
    const required = [
      "rsiWindowH1", "rsiBuyMax", "rsiSellMin",
      "flipSlopeMin", "flipDslopeMin", "dbbzBuyMin", "dbbzSellMax"
    ];
    return required.every(k => Number.isFinite(Number(cfg[k])));
  }

  function getMinMaxRSI_H1(rows, currentIdx, barsH1 = 5) {
    if (!Array.isArray(rows) || currentIdx < 0) return null;

    let count      = 0;
    let minRSI     = Infinity;
    let maxRSI     = -Infinity;
    let currentRSI = null;
    let lastHour   = null;

    for (let k = currentIdx; k >= 0; k--) {
      const ts   = rows[k]?.timestamp;
      const hour = ts?.slice(0, 13);
      if (!hour) continue;

      if (hour === lastHour) continue;
      lastHour = hour;

      const rsi = num(rows[k]?.rsi_h1);
      if (rsi === null) return null;

      if (currentRSI === null) currentRSI = rsi;
      if (rsi < minRSI) minRSI = rsi;
      if (rsi > maxRSI) maxRSI = rsi;

      count++;
      if (count >= barsH1) break;
    }

    if (count < barsH1) return null;
    return { minRSI, maxRSI, currentRSI };
  }

  function getH1Dynamics(row) {
    const slope  = num(row?.slope_h1);
    const dslope = num(row?.dslope_h1);
    const dbbz   = num(row?.dz_h1);
    if (slope === null || dslope === null || dbbz === null) return null;
    return { slope, dslope, dbbz };
  }

  // ── RSI PATH ────────────────────────────────────────────────────────────────

  function isEarlyBuyConfirmed(dyn, cfg) {
    const slope1 = dyn.slope - dyn.dslope;
    if (!(slope1 < 0 && dyn.slope > 0)) return false;
    if (Math.abs(dyn.slope)  < cfg.flipSlopeMin)  return false;
    if (Math.abs(dyn.dslope) < cfg.flipDslopeMin) return false;
    return true;
  }

  function isEarlySellConfirmed(dyn, cfg) {
    const slope1 = dyn.slope - dyn.dslope;
    if (!(slope1 > 0 && dyn.slope < 0)) return false;
    if (Math.abs(dyn.slope)  < cfg.flipSlopeMin)  return false;
    if (Math.abs(dyn.dslope) < cfg.flipDslopeMin) return false;
    return true;
  }

  function detectBuy(rsiStats, dyn, cfg) {
    if (rsiStats.minRSI > cfg.rsiBuyMax) return null;
    if (dyn.dbbz < cfg.dbbzBuyMin)       return null;
    if (isEarlyBuyConfirmed(dyn, cfg)) return "BUY_EARLY";
    return "BUY";
  }

  function detectSell(rsiStats, dyn, cfg) {
    if (rsiStats.maxRSI < cfg.rsiSellMin) return null;
    if (dyn.dbbz > cfg.dbbzSellMax)       return null;
    if (isEarlySellConfirmed(dyn, cfg)) return "SELL_EARLY";
    return "SELL";
  }

  // ── PHASE PATH ───────────────────────────────────────────────────────────────

  const PHASE_BONUS_REV = {
    REVERSAL_START:  60,
    CLIMAX_SLOWING:  40,
    MATURE_END:      20,
    EXPANSION_END:   10,
  };

  function detectBuyPhase(dyn, cfg) {
    const phase = detectReversalPhase(dyn.slope, dyn.dslope, "BUY", cfg);
    return phase ? `BUY_${phase}` : null;
  }

  function detectSellPhase(dyn, cfg) {
    const phase = detectReversalPhase(dyn.slope, dyn.dslope, "SELL", cfg);
    return phase ? `SELL_${phase}` : null;
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  const PHASE_NAMES = ["REVERSAL_START", "CLIMAX_SLOWING", "MATURE_END", "EXPANSION_END"];

  function getPhaseFromSignalType(signalType) {
    return PHASE_NAMES.find(p => signalType.includes(p)) ?? null;
  }

  function getRegime(signalType) {
    if (signalType.includes("EARLY"))          return "H1_EARLY_REVERSAL";
    if (signalType.includes("REVERSAL_START")) return "H1_REVERSAL_START";
    if (signalType.includes("CLIMAX_SLOWING")) return "H1_CLIMAX_SLOWING";
    if (signalType.includes("MATURE_END"))     return "H1_MATURE_END";
    if (signalType.includes("EXPANSION_END"))  return "H1_EXPANSION_END";
    return "H1_REVERSAL";
  }

  // ── SCORE ───────────────────────────────────────────────────────────────────

  function computeScore(rsiStats, dyn, signalType, cfg) {
    let score = 0;

    const phase = getPhaseFromSignalType(signalType);
    if (phase) {
      score += PHASE_BONUS_REV[phase] ?? 0;
      score += Math.round(Math.abs(dyn.slope)  * 10);
      score += Math.round(Math.abs(dyn.dslope) * 20);
    } else {
      const side = signalType.startsWith("BUY") ? "BUY" : "SELL";
      if (side === "BUY") {
        score += Math.round((cfg.rsiBuyMax - rsiStats.minRSI) * 2);
        score += Math.round(dyn.dslope * 100);
        score += Math.round(dyn.dbbz * 50);
      } else {
        score += Math.round((rsiStats.maxRSI - cfg.rsiSellMin) * 2);
        score += Math.round((-dyn.dslope) * 100);
        score += Math.round((-dyn.dbbz) * 50);
      }
      if (signalType.includes("EARLY")) score += cfg.earlyScoreBonus;
    }

    return Math.max(0, score);
  }

  // ── EVALUATE ─────────────────────────────────────────────────────────────────

  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const symbol = rows[0]?.symbol;
    if (!symbol) return [];

    const assetCfg = getSignalConfig(symbol);
    const cfg      = assetCfg?.h1Reversal;
    if (!isValidCfg(cfg)) return [];

    const scoreMin = num(opts.scoreMin) ?? 0;
    const opportunities = [];

    // ── COMPTEURS DIAGNOSTICS ────────────────────────────────────────
    const d = {
      total: 0, noRsiStats: 0, noDyn: 0,
      buyRsiTooHigh: 0, buyDbbzTooLow: 0,
      sellRsiTooLow: 0, sellDbbzTooHigh: 0,
      rsiM1Filtered: 0, scoreMin: 0, signals: 0,
      phases: { REVERSAL_START: 0, CLIMAX_SLOWING: 0, MATURE_END: 0, EXPANSION_END: 0 },
    };

    for (let i = 0; i < rows.length; i++) {
      const ts = rows[i]?.timestamp;
      if (!ts) continue;
      d.total++;

      const rsiStats = getMinMaxRSI_H1(rows, i, cfg.rsiWindowH1);
      if (!rsiStats) { d.noRsiStats++; continue; }

      const dyn = getH1Dynamics(rows[i]);
      if (!dyn) { d.noDyn++; continue; }

      // Comptage détaillé des rejets RSI/dbbz (pour diagnostic)
      if (rsiStats.minRSI > cfg.rsiBuyMax)   d.buyRsiTooHigh++;
      if (dyn.dbbz < cfg.dbbzBuyMin)         d.buyDbbzTooLow++;
      if (rsiStats.maxRSI < cfg.rsiSellMin)  d.sellRsiTooLow++;
      if (dyn.dbbz > cfg.dbbzSellMax)        d.sellDbbzTooHigh++;

      const signalType = detectBuy(rsiStats, dyn, cfg)
                      ?? detectSell(rsiStats, dyn, cfg)
                      ?? detectBuyPhase(dyn, cfg)
                      ?? detectSellPhase(dyn, cfg);
      if (!signalType) continue;

      const signalPhase = getPhaseFromSignalType(signalType);
      if (signalPhase) d.phases[signalPhase] = (d.phases[signalPhase] ?? 0) + 1;

      const side   = signalType.startsWith("BUY") ? "BUY" : "SELL";
      const regime = getRegime(signalType);

      // M1 RSI timing — évite d'entrer en haut/bas d'un spike M1
      const rsi_m1       = num(rows[i]?.rsi_m1);
      const rsiM1BuyMax  = TIMING_CONFIG.M1.rsiBuyMax;
      const rsiM1SellMin = TIMING_CONFIG.M1.rsiSellMin;
      if (side === "BUY"  && rsi_m1 !== null && rsi_m1 > rsiM1BuyMax)  { d.rsiM1Filtered++; continue; }
      if (side === "SELL" && rsi_m1 !== null && rsi_m1 < rsiM1SellMin) { d.rsiM1Filtered++; continue; }

      const score = computeScore(rsiStats, dyn, signalType, cfg);
      if (score < scoreMin) { d.scoreMin++; continue; }
      d.signals++;

      opportunities.push({
        type:        "reversal",
        index:       rows[i]?.index ?? i,
        timestamp:   ts,
        symbol,
        side,
        signalType,
        signalPhase,
        regime,
        score,
        raw_score:   score,

        rsi_h1:      rsiStats.currentRSI,
        minrsi_h1:   rsiStats.minRSI,
        maxrsi_h1:   rsiStats.maxRSI,

        slope_h1:    dyn.slope,
        dslope_h1:   dyn.dslope,
        dz_h1:       dyn.dbbz,

        atr_m15:     num(rows[i]?.atr_m15),
        atr_h1:      num(rows[i]?.atr_h1),
        close:       num(rows[i]?.close),

        rsi_m1:      num(rows[i]?.rsi_m1),
        slope_m1:    num(rows[i]?.slope_m1),
        zscore_m1:   num(rows[i]?.zscore_m1),
        drsi_m1:     num(rows[i]?.drsi_m1),
        dslope_m1:   num(rows[i]?.dslope_m1),
        dz_m1:       num(rows[i]?.dz_m1),
        atr_m1:      num(rows[i]?.atr_m1),

        rsi_m5:      num(rows[i]?.rsi_m5),
        slope_m5:    num(rows[i]?.slope_m5),
        drsi_m5:     num(rows[i]?.drsi_m5),
        dslope_m5:   num(rows[i]?.dslope_m5),
      });
    }

    const processed = d.total - d.noRsiStats - d.noDyn;
    console.info("📊 REVERSAL SIGNAL REPORT", {
      total_bars:      d.total,
      no_rsi_window:   d.noRsiStats,
      no_h1_dynamics:  d.noDyn,
      processed,
      buy_rsi_too_high:   d.buyRsiTooHigh,
      buy_dbbz_too_low:   d.buyDbbzTooLow,
      sell_rsi_too_low:   d.sellRsiTooLow,
      sell_dbbz_too_high: d.sellDbbzTooHigh,
      rsi_m1_filtered:    d.rsiM1Filtered,
      score_too_low:      d.scoreMin,
      signals_generated:  d.signals,
      phase_signals: Object.values(d.phases).reduce((a, b) => a + b, 0),
      phases: d.phases,
      pct_signals: processed > 0
        ? `${((d.signals / processed) * 100).toFixed(2)}%`
        : "—",
      cfg: {
        rsiBuyMax: cfg.rsiBuyMax, rsiSellMin: cfg.rsiSellMin,
        dbbzBuyMin: cfg.dbbzBuyMin, dbbzSellMax: cfg.dbbzSellMax,
        phaseExpansionSlopeMin: cfg.phaseExpansionSlopeMin,
        phaseExpansionSlopeMax: cfg.phaseExpansionSlopeMax,
        phaseMatureSlopeMax:    cfg.phaseMatureSlopeMax,
        phaseAccelDslopeMin:    cfg.phaseAccelDslopeMin,
      },
    });

    return opportunities;
  }

  return { evaluate };

})();

export default ReversalStrategy;
