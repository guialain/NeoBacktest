// ============================================================================
// continuation.js — H1 CONTINUATION STRATEGY
// Conditions :
//   H1 tendance établie (slope >= 1.5) + RSI zone momentum
//   M5 aligné + reprise du momentum (dslope_m5 dans le sens du trade)
// ============================================================================

import { getSignalConfig } from "../config/MultipliersConfig";
import { TIMING_CONFIG } from "../config/TimingConfig";

const ContinuationStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  function getCfg(symbol) {
    const assetCfg = getSignalConfig(symbol);
    return assetCfg?.h1Continuation ?? {};
  }

  // =========================================================
  // DETECTION BUY
  // =========================================================
  function detectBuy(row, cfg) {
    const slope_h1   = num(row?.slope_h1);
    const dslope_h1  = num(row?.dslope_h1);
    const rsi_h1     = num(row?.rsi_h1);
    const rsi_m5     = num(row?.rsi_m5);
    const slope_m5   = num(row?.slope_m5);
    const dslope_m5  = num(row?.dslope_m5);
    const zscore_h1  = num(row?.zscore_h1);
    const dz_h1      = num(row?.dz_h1);

    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null ||
        rsi_m5 === null || slope_m5 === null || dslope_m5 === null) return false;

    if (slope_h1  <  cfg.slopeH1Min)      return false; // tendance H1 trop faible
    if (rsi_h1    <  cfg.rsiBuyMin)       return false; // rsi_h1 trop bas
    if (rsi_h1    >  cfg.rsiBuyMax)       return false; // rsi_h1 trop haut
    if (rsi_m5    >  TIMING_CONFIG.M5.rsiBuyMax)           return false; // rsi_m5 déjà étiré
    if (num(row?.rsi_m1) !== null && num(row?.rsi_m1) > TIMING_CONFIG.M1.rsiBuyMax)  return false; // rsi_m1 spike haut
    if (dslope_h1 <  cfg.dslopeH1DirMin)    return false; // retournement H1 trop fort
    if (dslope_h1 >  cfg.dslopeH1MaxAbs)   return false; // spike H1
    if (dslope_h1 <  cfg.dslopeH1BuyMin)   return false; // momentum H1 insuffisant
    if (slope_m5  <=  TIMING_CONFIG.M5.slopeMin)  return false; // M5 pas aligné haussier
    if (dslope_m5 <=  TIMING_CONFIG.M5.dslopeMin) return false; // pas de reprise momentum M5
    if (zscore_h1 !== null && zscore_h1 < cfg.zscoreH1BuyMin)  return false; // prix sous midline BB
    if (zscore_h1 !== null && zscore_h1 > cfg.zscoreH1BuyMax)  return false; // prix au-delà upper BB
    if (dz_h1     !== null && dz_h1     > cfg.dzH1BuyMax)      return false; // BB monte trop vite
    if (zscore_h1 !== null && dz_h1 !== null &&
        zscore_h1 < cfg.zscoreH1BuyMax && dz_h1 < cfg.dzH1RepliMin)  return false; // BB en repli sous upper band

    return true;
  }

  // =========================================================
  // DETECTION SELL
  // =========================================================
  function detectSell(row, cfg) {
    const slope_h1   = num(row?.slope_h1);
    const dslope_h1  = num(row?.dslope_h1);
    const rsi_h1     = num(row?.rsi_h1);
    const rsi_m5     = num(row?.rsi_m5);
    const slope_m5   = num(row?.slope_m5);
    const dslope_m5  = num(row?.dslope_m5);
    const zscore_h1  = num(row?.zscore_h1);
    const dz_h1      = num(row?.dz_h1);

    if (slope_h1 === null || dslope_h1 === null || rsi_h1 === null ||
        rsi_m5 === null || slope_m5 === null || dslope_m5 === null) return false;

    if (slope_h1  >  -cfg.slopeH1Min)      return false; // tendance H1 trop faible
    if (rsi_h1    <   cfg.rsiSellMin)      return false; // rsi_h1 trop bas
    if (rsi_h1    >   cfg.rsiSellMax)      return false; // rsi_h1 trop haut
    if (rsi_m5    <   TIMING_CONFIG.M5.rsiSellMin)          return false; // rsi_m5 déjà étiré → pas un pullback
    if (num(row?.rsi_m1) !== null && num(row?.rsi_m1) < TIMING_CONFIG.M1.rsiSellMin) return false; // rsi_m1 spike bas
    if (dslope_h1 >   cfg.dslopeH1DirMax)    return false; // retournement H1 trop fort
    if (dslope_h1 <  -cfg.dslopeH1MaxAbs)   return false; // spike H1
    if (dslope_h1 >  -cfg.dslopeH1BuyMin)   return false; // momentum H1 insuffisant
    if (slope_m5  >= -TIMING_CONFIG.M5.slopeMin)  return false; // M5 pas aligné baissier
    if (dslope_m5 >= -TIMING_CONFIG.M5.dslopeMin) return false; // pas de reprise momentum M5
    if (zscore_h1 !== null && zscore_h1 > cfg.zscoreH1SellMax)  return false; // prix au-dessus midline BB
    if (zscore_h1 !== null && zscore_h1 < cfg.zscoreH1SellMin)  return false; // prix au-delà lower BB
    if (dz_h1     !== null && dz_h1     < cfg.dzH1SellMin)      return false; // BB descend trop vite
    if (zscore_h1 !== null && dz_h1 !== null &&
        zscore_h1 > cfg.zscoreH1SellMin && dz_h1 > -cfg.dzH1RepliMin)  return false; // BB en repli sous lower band

    return true;
  }

  // =========================================================
  // SCORE
  // Force tendance H1 + alignement M5 + distance RSI du 50
  // =========================================================
  function computeScore(row) {
    const slope_h1 = Math.abs(num(row?.slope_h1) ?? 0);
    const slope_m5 = Math.abs(num(row?.slope_m5) ?? 0);
    const rsi_h1   = num(row?.rsi_h1) ?? 50;

    return Math.max(0, Math.round(
      slope_h1 * 50 +
      slope_m5 * 30 +
      Math.abs(rsi_h1 - 50) * 2
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
      rsiH1OutRange: 0,
      rsiM5OutRange: 0,
      dslopeH1Wrong: 0,
      dslopeH1Spike: 0,
      slopeM5Wrong: 0,
      dslopeM5Wrong: 0,
      scoreMin: 0,
      signals: 0,
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

      if (slope_h1 !== null && Math.abs(slope_h1) < cfg.slopeH1Min) d.slopeH1Weak++;
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
      if (dslope_h1 !== null && slope_h1 !== null) {
        const dirOk = (slope_h1 > 0 && dslope_h1 >= cfg.dslopeH1DirMin) ||
                      (slope_h1 < 0 && dslope_h1 <= cfg.dslopeH1DirMax);
        if (!dirOk) d.dslopeH1Wrong++;
        const spikeOk = Math.abs(dslope_h1) <= cfg.dslopeH1MaxAbs;
        if (!spikeOk) d.dslopeH1Spike++;
      }
      if (slope_m5 !== null && slope_h1 !== null) {
        const m5Ok = (slope_h1 > 0 && slope_m5 > 0) || (slope_h1 < 0 && slope_m5 < 0);
        if (!m5Ok) d.slopeM5Wrong++;
      }
      if (dslope_m5 !== null && slope_h1 !== null) {
        const dm5Ok = (slope_h1 > 0 && dslope_m5 > 0) || (slope_h1 < 0 && dslope_m5 < 0);
        if (!dm5Ok) d.dslopeM5Wrong++;
      }

      let side = null;
      if      (detectBuy(row, cfg))  side = "BUY";
      else if (detectSell(row, cfg)) side = "SELL";
      if (!side) continue;

      const score = computeScore(row);
      if (score < scoreMin) { d.scoreMin++; continue; }
      d.signals++;

      opportunities.push({
        type:       "continuation",
        index:      row?.index ?? i,
        timestamp:  ts,
        symbol,
        side,
        signalType: side,
        regime:     "H1_CONTINUATION",
        score,
        raw_score:  score,

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
      // Rejets par condition (une barre peut être rejetée par plusieurs)
      slope_h1_weak:     d.slopeH1Weak,    // |slope_h1| < slopeH1Min (1.2)
      rsi_h1_out_range:  d.rsiH1OutRange,  // rsi_h1 hors zone 40-65/35-60
      rsi_m5_out_range:  d.rsiM5OutRange,  // rsi_m5 hors zone BuyMax/SellMin
      dslope_h1_wrong:   d.dslopeH1Wrong,  // momentum H1 retournement
      dslope_h1_spike:   d.dslopeH1Spike,  // momentum H1 trop violent
      slope_m5_wrong:    d.slopeM5Wrong,   // slope_m5 pas aligné
      dslope_m5_wrong:   d.dslopeM5Wrong,  // dslope_m5 pas aligné
      score_too_low:     d.scoreMin,
      cfg: {
        slopeH1Min: cfg.slopeH1Min,
        rsiBuyMin: cfg.rsiBuyMin, rsiBuyMax: cfg.rsiBuyMax,
        rsiSellMin: cfg.rsiSellMin, rsiSellMax: cfg.rsiSellMax,
        rsiM5BuyMax: cfg.rsiM5BuyMax, rsiM5SellMin: cfg.rsiM5SellMin,
      },
    });

    return opportunities;
  }

  return { evaluate };

})();

export default ContinuationStrategy;
