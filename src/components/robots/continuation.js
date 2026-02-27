// ============================================================================
// continuation.js — H1 CONTINUATION STRATEGY
// Phases valides (SignalPhaseDetector) :
//   EXPANSION_ACCELERATING — slope 1.5-3.5 + dslope ≥ 1.5  ← meilleure entrée
//   EXPANSION              — slope 1.5-3.5 + dslope > 0
//   EARLY_TREND            — slope < 1.5    + dslope ≥ 1.5  ← début de tendance
//   MATURE_CONTINUATION    — slope 3.5-5.0  + dslope > 0
// Bloqués : FLAT | EXPANSION_SLOWING | MATURE_SLOWING | CLIMAX_RUN
// ============================================================================

import { getSignalConfig } from "../config/MultipliersConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";
import { detectContinuationPhase } from "./SignalPhaseDetector";

const ContinuationStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  function getCfg(symbol) {
    const assetCfg = getSignalConfig(symbol);
    return assetCfg?.h1Continuation ?? {};
  }

  // Bonus de score par phase (meilleure entrée = score plus élevé)
  const PHASE_BONUS = {
    EXPANSION_ACCELERATING: 40,
    EXPANSION:              20,
    EARLY_TREND:            15,
    MATURE_CONTINUATION:     5,
  };

  // =========================================================
  // DETECTION BUY — returns phase string or null
  // =========================================================
  function detectBuy(row, cfg) {
    const slope_h1  = num(row?.slope_h1);
    const dslope_h1 = num(row?.dslope_h1);
    const rsi_h1    = num(row?.rsi_h1);
    const rsi_m5    = num(row?.rsi_m5);
    const slope_m5  = num(row?.slope_m5);
    const dslope_m5 = num(row?.dslope_m5);
    const zscore_h1 = num(row?.zscore_h1);
    const dz_h1     = num(row?.dz_h1);

    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null ||
        rsi_m5 === null || slope_m5 === null || dslope_m5 === null) return null;

    const phase = detectContinuationPhase(slope_h1, dslope_h1, "BUY", cfg);
    if (!phase) return null;

    if (Math.abs(dslope_h1) > cfg.dslopeH1MaxAbs)                              return null; // spike H1
    if (rsi_h1 < cfg.rsiBuyMin || rsi_h1 > cfg.rsiBuyMax)                      return null; // rsi_h1 hors zone
    if (rsi_m5  > TIMING_CONFIG.M5.rsiBuyMax)                                   return null; // rsi_m5 déjà étiré
    if (num(row?.rsi_m1) !== null && num(row?.rsi_m1) > TIMING_CONFIG.M1.rsiBuyMax) return null; // rsi_m1 spike
    if (slope_m5 <= TIMING_CONFIG.M5.slopeMin)                                  return null; // M5 pas aligné haussier
    if (dslope_m5 <= TIMING_CONFIG.M5.dslopeMin)                                return null; // pas de reprise momentum M5
    if (zscore_h1 !== null && zscore_h1 < cfg.zscoreH1BuyMin)                   return null; // prix sous midline BB
    if (zscore_h1 !== null && zscore_h1 > cfg.zscoreH1BuyMax)                   return null; // prix au-delà upper BB
    if (dz_h1     !== null && dz_h1     > cfg.dzH1BuyMax)                       return null; // BB monte trop vite
    if (zscore_h1 !== null && dz_h1 !== null &&
        zscore_h1 < cfg.zscoreH1BuyMax && dz_h1 < cfg.dzH1RepliMin)             return null; // BB en repli sous upper band

    return phase;
  }

  // =========================================================
  // DETECTION SELL — returns phase string or null
  // =========================================================
  function detectSell(row, cfg) {
    const slope_h1  = num(row?.slope_h1);
    const dslope_h1 = num(row?.dslope_h1);
    const rsi_h1    = num(row?.rsi_h1);
    const rsi_m5    = num(row?.rsi_m5);
    const slope_m5  = num(row?.slope_m5);
    const dslope_m5 = num(row?.dslope_m5);
    const zscore_h1 = num(row?.zscore_h1);
    const dz_h1     = num(row?.dz_h1);

    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null ||
        rsi_m5 === null || slope_m5 === null || dslope_m5 === null) return null;

    const phase = detectContinuationPhase(slope_h1, dslope_h1, "SELL", cfg);
    if (!phase) return null;

    if (Math.abs(dslope_h1) > cfg.dslopeH1MaxAbs)                               return null; // spike H1
    if (rsi_h1 < cfg.rsiSellMin || rsi_h1 > cfg.rsiSellMax)                     return null; // rsi_h1 hors zone
    if (rsi_m5  < TIMING_CONFIG.M5.rsiSellMin)                                   return null; // rsi_m5 déjà étiré
    if (num(row?.rsi_m1) !== null && num(row?.rsi_m1) < TIMING_CONFIG.M1.rsiSellMin) return null; // rsi_m1 spike
    if (slope_m5 >= -TIMING_CONFIG.M5.slopeMin)                                  return null; // M5 pas aligné baissier
    if (dslope_m5 >= -TIMING_CONFIG.M5.dslopeMin)                                return null; // pas de reprise momentum M5
    if (zscore_h1 !== null && zscore_h1 > cfg.zscoreH1SellMax)                   return null; // prix au-dessus midline BB
    if (zscore_h1 !== null && zscore_h1 < cfg.zscoreH1SellMin)                   return null; // prix au-delà lower BB
    if (dz_h1     !== null && dz_h1     < cfg.dzH1SellMin)                       return null; // BB descend trop vite
    if (zscore_h1 !== null && dz_h1 !== null &&
        zscore_h1 > cfg.zscoreH1SellMin && dz_h1 > -cfg.dzH1RepliMin)            return null; // BB en repli sous lower band

    return phase;
  }

  // =========================================================
  // SCORE — Force tendance H1 + alignement M5 + RSI + bonus phase
  // =========================================================
  function computeScore(row, phase) {
    const slope_h1 = Math.abs(num(row?.slope_h1) ?? 0);
    const slope_m5 = Math.abs(num(row?.slope_m5) ?? 0);
    const rsi_h1   = num(row?.rsi_h1) ?? 50;
    const bonus    = PHASE_BONUS[phase] ?? 0;

    return Math.max(0, Math.round(
      slope_h1 * 50 +
      slope_m5 * 30 +
      Math.abs(rsi_h1 - 50) * 2 +
      bonus
    ));
  }

  // =========================================================
  // EVALUATE
  // =========================================================
  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const symbol = rows[0]?.symbol;
    if (!symbol) return [];

    const cfg      = getCfg(symbol);
    const scoreMin = num(opts.scoreMin) ?? 0;
    const opportunities = [];

    // ── COMPTEURS DIAGNOSTICS ────────────────────────────────────────
    const d = {
      total: 0,
      slopeH1Weak: 0,
      slopeH1Strong: 0,
      rsiH1OutRange: 0,
      rsiM5OutRange: 0,
      dslopeH1Spike: 0,
      slopeM5Wrong: 0,
      dslopeM5Wrong: 0,
      scoreMin: 0,
      signals: 0,
      phases: { EXPANSION_ACCELERATING: 0, EXPANSION: 0, EARLY_TREND: 0, MATURE_CONTINUATION: 0 },
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const ts  = row?.timestamp;
      if (!ts) continue;
      d.total++;

      // Comptage détaillé par condition rejetée
      const slope_h1  = num(row?.slope_h1);
      const dslope_h1 = num(row?.dslope_h1);
      const rsi_h1    = num(row?.rsi_h1);
      const rsi_m5    = num(row?.rsi_m5);
      const slope_m5  = num(row?.slope_m5);
      const dslope_m5 = num(row?.dslope_m5);

      if (slope_h1 !== null && Math.abs(slope_h1) < cfg.slopeH1Min)              d.slopeH1Weak++;
      if (slope_h1 !== null && Math.abs(slope_h1) > (cfg.slopeH1Max ?? Infinity)) d.slopeH1Strong++;
      if (rsi_h1 !== null) {
        const rsiOk = (slope_h1 > 0 && rsi_h1 >= cfg.rsiBuyMin  && rsi_h1 <= cfg.rsiBuyMax) ||
                      (slope_h1 < 0 && rsi_h1 >= cfg.rsiSellMin && rsi_h1 <= cfg.rsiSellMax);
        if (!rsiOk) d.rsiH1OutRange++;
      }
      if (rsi_m5 !== null && slope_h1 !== null) {
        const rsiM5Ok = (slope_h1 > 0 && rsi_m5 <= TIMING_CONFIG.M5.rsiBuyMax) ||
                        (slope_h1 < 0 && rsi_m5 >= TIMING_CONFIG.M5.rsiSellMin);
        if (!rsiM5Ok) d.rsiM5OutRange++;
      }
      if (dslope_h1 !== null && Math.abs(dslope_h1) > cfg.dslopeH1MaxAbs) d.dslopeH1Spike++;
      if (slope_m5 !== null && slope_h1 !== null) {
        const m5Ok = (slope_h1 > 0 && slope_m5 > 0) || (slope_h1 < 0 && slope_m5 < 0);
        if (!m5Ok) d.slopeM5Wrong++;
      }
      if (dslope_m5 !== null && slope_h1 !== null) {
        const dm5Ok = (slope_h1 > 0 && dslope_m5 > 0) || (slope_h1 < 0 && dslope_m5 < 0);
        if (!dm5Ok) d.dslopeM5Wrong++;
      }

      const buyPhase  = detectBuy(row, cfg);
      const sellPhase = buyPhase ? null : detectSell(row, cfg);
      const phase     = buyPhase ?? sellPhase;
      const side      = buyPhase ? "BUY" : sellPhase ? "SELL" : null;
      if (!side) continue;

      const score = computeScore(row, phase);
      if (score < scoreMin) { d.scoreMin++; continue; }
      d.signals++;
      d.phases[phase] = (d.phases[phase] ?? 0) + 1;

      opportunities.push({
        type:        "continuation",
        index:       row?.index ?? i,
        timestamp:   ts,
        symbol,
        side,
        signalType:  side,
        signalPhase: phase,
        regime:      "H1_CONTINUATION",
        score,
        raw_score:   score,

        rsi_h1:    num(row?.rsi_h1),
        slope_h1:  num(row?.slope_h1),
        dslope_h1: num(row?.dslope_h1),
        dz_h1:     num(row?.dz_h1),

        atr_m15:   num(row?.atr_m15),
        atr_h1:    num(row?.atr_h1),
        close:     num(row?.close),

        rsi_m1:    num(row?.rsi_m1),
        slope_m1:  num(row?.slope_m1),
        zscore_m1: num(row?.zscore_m1),
        drsi_m1:   num(row?.drsi_m1),
        dslope_m1: num(row?.dslope_m1),
        dz_m1:     num(row?.dz_m1),
        atr_m1:    num(row?.atr_m1),

        rsi_m5:    num(row?.rsi_m5),
        slope_m5:  num(row?.slope_m5),
        drsi_m5:   num(row?.drsi_m5),
        dslope_m5: num(row?.dslope_m5),
      });
    }

    console.info("📊 CONTINUATION SIGNAL REPORT", {
      total_bars:        d.total,
      signals_generated: d.signals,
      pct_signals: d.total > 0
        ? `${((d.signals / d.total) * 100).toFixed(2)}%`
        : "—",
      slope_h1_weak:    d.slopeH1Weak,
      slope_h1_strong:  d.slopeH1Strong,
      rsi_h1_out_range: d.rsiH1OutRange,
      rsi_m5_out_range: d.rsiM5OutRange,
      dslope_h1_spike:  d.dslopeH1Spike,
      slope_m5_wrong:   d.slopeM5Wrong,
      dslope_m5_wrong:  d.dslopeM5Wrong,
      score_too_low:    d.scoreMin,
      phases:           d.phases,
      cfg: {
        phaseExpansionSlopeMin: cfg.phaseExpansionSlopeMin,
        phaseExpansionSlopeMax: cfg.phaseExpansionSlopeMax,
        phaseMatureSlopeMax:    cfg.phaseMatureSlopeMax,
        phaseAccelDslopeMin:    cfg.phaseAccelDslopeMin,
        dslopeH1MaxAbs: cfg.dslopeH1MaxAbs,
        rsiBuyMin: cfg.rsiBuyMin, rsiBuyMax: cfg.rsiBuyMax,
        rsiSellMin: cfg.rsiSellMin, rsiSellMax: cfg.rsiSellMax,
      },
    });

    return opportunities;
  }

  return { evaluate };

})();

export default ContinuationStrategy;
