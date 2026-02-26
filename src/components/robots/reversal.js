// ============================================================================
// reversal.js — H1 REVERSAL STRATEGY
// Extrait de TopOpportunities.js
// ============================================================================

import { getSignalConfig } from "../config/SignalConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";

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

  function computeScore(rsiStats, dyn, signalType, cfg) {
    let score = 0;
    const side = signalType.includes("BUY") ? "BUY" : "SELL";

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
    return Math.max(0, score);
  }

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
    };

    for (let i = 0; i < rows.length; i++) {
      const ts = rows[i]?.timestamp;
      if (!ts) continue;
      d.total++;

      const rsiStats = getMinMaxRSI_H1(rows, i, cfg.rsiWindowH1);
      if (!rsiStats) { d.noRsiStats++; continue; }

      const dyn = getH1Dynamics(rows[i]);
      if (!dyn) { d.noDyn++; continue; }

      // Comptage détaillé des rejets BUY / SELL
      const buyRejRsi  = rsiStats.minRSI > cfg.rsiBuyMax;
      const buyRejDbbz = dyn.dbbz < cfg.dbbzBuyMin;
      const selRejRsi  = rsiStats.maxRSI < cfg.rsiSellMin;
      const selRejDbbz = dyn.dbbz > cfg.dbbzSellMax;

      if (buyRejRsi)  d.buyRsiTooHigh++;
      if (buyRejDbbz) d.buyDbbzTooLow++;
      if (selRejRsi)  d.sellRsiTooLow++;
      if (selRejDbbz) d.sellDbbzTooHigh++;

      const signalType = detectBuy(rsiStats, dyn, cfg)
                      ?? detectSell(rsiStats, dyn, cfg);
      if (!signalType) continue;

      const side   = signalType.includes("BUY") ? "BUY" : "SELL";
      const regime = signalType.includes("EARLY") ? "H1_EARLY_REVERSAL" : "H1_REVERSAL";

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
      // Sur les barres avec données H1 valides — combien passent les seuils
      buy_rsi_too_high:   d.buyRsiTooHigh,   // minRSI > rsiBuyMax  (ex: 27)
      buy_dbbz_too_low:   d.buyDbbzTooLow,   // dbbz < dbbzBuyMin   (ex: 0.20)
      sell_rsi_too_low:   d.sellRsiTooLow,   // maxRSI < rsiSellMin (ex: 73)
      sell_dbbz_too_high: d.sellDbbzTooHigh, // dbbz > dbbzSellMax  (ex: -0.20)
      rsi_m1_filtered:    d.rsiM1Filtered,   // rsi_m1 hors zone timing
      score_too_low:      d.scoreMin,
      signals_generated: d.signals,
      pct_signals: processed > 0
        ? `${((d.signals / processed) * 100).toFixed(2)}%`
        : "—",
      cfg: { rsiBuyMax: cfg.rsiBuyMax, rsiSellMin: cfg.rsiSellMin,
             dbbzBuyMin: cfg.dbbzBuyMin, dbbzSellMax: cfg.dbbzSellMax },
    });

    return opportunities;
  }

  return { evaluate };

})();

export default ReversalStrategy;
