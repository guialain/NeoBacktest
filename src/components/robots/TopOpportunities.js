// ============================================================================
// TopOpportunities — H1 REVERSAL CLEAN STRUCTURE (v5)
// - Signal standard  : RSI extrême + dbbz (sans exiger le flip)
// - Signal early     : standard + flip slope (H1_EARLY_REVERSAL)
// - Fenêtre RSI = N bougies H1 réelles (déduplication M5 interne)
// - Prise de position à chaque bougie M5
// - Symétrie BUY/SELL + symbol verrouillé
// ============================================================================

import { getAssetConfig } from "../config/AssetConfig";

const TopOpportunities = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================================================
  // VALIDATE CONFIG
  // =========================================================
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

  // =========================================================
  // UTIL — Min/Max RSI sur les N dernières bougies H1 réelles
  // =========================================================
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

  // =========================================================
  // UTIL — Dynamiques H1
  // =========================================================
  function getH1Dynamics(row) {
    const slope  = num(row?.slope_h1);
    const dslope = num(row?.dslope_h1);
    const dbbz   = num(row?.dz_h1);

    if (slope === null || dslope === null || dbbz === null) return null;

    return { slope, dslope, dbbz };
  }

  // =========================================================
  // EARLY CONFIRMATION — flip de slope
  // slope1 = slope0 - dslope (barre précédente)
  // =========================================================
  function isEarlyBuyConfirmed(dyn, cfg) {
    const slope0 = dyn.slope;
    const dslope = dyn.dslope;
    const slope1 = slope0 - dslope;

    // BUY : slope passe de - à +
    if (!(slope1 < 0 && slope0 > 0)) return false;

    if (Math.abs(slope0) < cfg.flipSlopeMin)  return false;
    if (Math.abs(dslope) < cfg.flipDslopeMin) return false;

    return true;
  }

  function isEarlySellConfirmed(dyn, cfg) {
    const slope0 = dyn.slope;
    const dslope = dyn.dslope;
    const slope1 = slope0 - dslope;

    // SELL : slope passe de + à -
    if (!(slope1 > 0 && slope0 < 0)) return false;

    if (Math.abs(slope0) < cfg.flipSlopeMin)  return false;
    if (Math.abs(dslope) < cfg.flipDslopeMin) return false;

    return true;
  }

  // =========================================================
  // SIGNAL DETECTION
  // Retourne : "BUY_EARLY" | "BUY" | "SELL_EARLY" | "SELL" | null
  //
  // Logique :
  //   1. Vérifie les conditions de base (RSI extrême + dbbz)
  //   2. Si base OK → vérifie si c'est un early (flip slope)
  //   3. Retourne le type approprié
  // =========================================================
  function detectBuy(rsiStats, dyn, cfg) {
    // Base requise
    if (rsiStats.minRSI > cfg.rsiBuyMax) return null;
    if (dyn.dbbz < cfg.dbbzBuyMin)       return null;

    // Early ou standard ?
    if (isEarlyBuyConfirmed(dyn, cfg)) return "BUY_EARLY";
    return "BUY";
  }

  function detectSell(rsiStats, dyn, cfg) {
    // Base requise
    if (rsiStats.maxRSI < cfg.rsiSellMin) return null;
    if (dyn.dbbz > cfg.dbbzSellMax)       return null;

    // Early ou standard ?
    if (isEarlySellConfirmed(dyn, cfg)) return "SELL_EARLY";
    return "SELL";
  }

  // =========================================================
  // SCORE
  // =========================================================
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

    // Bonus early
    if (signalType.includes("EARLY")) score += 20;

    return Math.max(0, score);
  }

  // =========================================================
  // EVALUATE
  // - Boucle sur chaque bougie M5
  // - getMinMaxRSI_H1 déduplique en interne → fenêtre H1 correcte
  // =========================================================
  function evaluate(marketData = [], opts = {}) {

    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const symbol = rows[0]?.symbol;
    if (!symbol) return [];

    const assetCfg = getAssetConfig(symbol);
    const cfg      = assetCfg?.h1Reversal;

    if (!isValidCfg(cfg)) return [];

    const scoreMin = num(opts.scoreMin) ?? 0;

    const opportunities = [];

    for (let i = 0; i < rows.length; i++) {

      const ts = rows[i]?.timestamp;
      if (!ts) continue;

      const rsiStats = getMinMaxRSI_H1(rows, i, cfg.rsiWindowH1);
      if (!rsiStats) continue;

      const dyn = getH1Dynamics(rows[i]);
      if (!dyn) continue;

      // Détection BUY en priorité, puis SELL
      const signalType = detectBuy(rsiStats, dyn, cfg)
                      ?? detectSell(rsiStats, dyn, cfg);

      if (!signalType) continue;

      const side   = signalType.includes("BUY") ? "BUY" : "SELL";
      const regime = signalType.includes("EARLY") ? "H1_EARLY_REVERSAL" : "H1_REVERSAL";

      const score = computeScore(rsiStats, dyn, signalType, cfg);
      if (score < scoreMin) continue;

      opportunities.push({
        index:       rows[i]?.index ?? i,
        timestamp:   ts,
        symbol:      symbol,
        side,
        signalType,  // "BUY" | "BUY_EARLY" | "SELL" | "SELL_EARLY"
        regime,
        score,
        raw_score:   score,

        // ===== RSI WINDOW H1 =====
        rsi_h1:      rsiStats.currentRSI,
        minrsi_h1:   rsiStats.minRSI,
        maxrsi_h1:   rsiStats.maxRSI,

        // ===== DYNAMICS H1 =====
        slope_h1:    dyn.slope,
        dslope_h1:   dyn.dslope,
        dz_h1:       dyn.dbbz,

        // ===== VOLATILITY CONTEXT =====
        atr_h1:      num(rows[i]?.atr_h1),
        close:       num(rows[i]?.close),

        // ===== MICRO M5 =====
        rsi_m5:      num(rows[i]?.rsi_m5),
        slope_m5:    num(rows[i]?.slope_m5),
        drsi_m5:     num(rows[i]?.drsi_m5),
        dslope_m5:   num(rows[i]?.dslope_m5)
      });
    }

    return opportunities;
  }

  return { evaluate };

})();

export default TopOpportunities;