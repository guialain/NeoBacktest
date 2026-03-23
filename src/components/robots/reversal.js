// ============================================================================
// reversal.js — M15 REVERSAL STRATEGY
// - M15 detector: rsi_m15 extreme + dslope_m15 momentum + dslope_h1 context
// - H1 provides structural context (deceleration), M15 provides timing
// ============================================================================

import { getSignalConfig } from "../config/SignalConfig.js";
import { getRiskConfig } from "../config/RiskConfig.js";

const ReversalStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // CONFIG VALIDATION
  // ============================================================================
  function isValidCfg(cfg) {
    return cfg != null;
  }

  // ============================================================================
  // H1 DYNAMICS
  // ============================================================================
  function getH1Dynamics(row) {
    const slope  = num(row?.slope_h1);
    const dslope = num(row?.dslope_h1);
    const dbbz   = num(row?.dz_h1);
    const zscore = num(row?.zscore_h1);

    if (slope === null || dslope === null || dbbz === null) return null;

    return { slope, dslope, dbbz, zscore };
  }

  // ============================================================================
  // EXTREME REVERSAL — zones [0-25], [25-30], [70-75], [75-100]
  // Marché très étiré sur H1 + M15, les deux commencent à ralentir
  // ============================================================================
  function detectBuyExtreme(row, dyn) {
    const slope_h1   = num(dyn?.slope);
    const dslope_h1  = num(dyn?.dslope);
    const slope_m15  = num(row?.slope_m15);
    const dslope_m15 = num(row?.dslope_m15);

    if (slope_h1 === null || dslope_h1 === null || slope_m15 === null || dslope_m15 === null)
      return null;

    if (slope_h1 < -7 && slope_m15 < -2 && dslope_m15 > 0 && dslope_h1 > 0)
      return "BUY";

    return null;
  }

  function detectSellExtreme(row, dyn) {
    const slope_h1   = num(dyn?.slope);
    const dslope_h1  = num(dyn?.dslope);
    const slope_m15  = num(row?.slope_m15);
    const dslope_m15 = num(row?.dslope_m15);

    if (slope_h1 === null || dslope_h1 === null || slope_m15 === null || dslope_m15 === null)
      return null;

    if (slope_h1 > 7 && slope_m15 > 2 && dslope_m15 < 0 && dslope_h1 < 0)
      return "SELL";

    return null;
  }

  // ============================================================================
  // NEAR REVERSAL — zones [30-35] slope>0, [65-70] slope<0
  // H1 vient de tourner, M15 confirme la direction
  // ============================================================================
  function detectBuyNear(row, dyn) {
    const dslope_h1  = num(dyn?.dslope);
    const dslope_m15 = num(row?.dslope_m15);

    if (dslope_h1 === null || dslope_m15 === null) return null;

    // H1 déjà tourné (slope>0 garanti par routeur) + M15 confirme + H1 accélère
    if (dslope_m15 > 0 && dslope_h1 > 0) return "BUY";

    return null;
  }

  function detectSellNear(row, dyn) {
    const dslope_h1  = num(dyn?.dslope);
    const dslope_m15 = num(row?.dslope_m15);

    if (dslope_h1 === null || dslope_m15 === null) return null;

    // H1 déjà tourné (slope<0 garanti par routeur) + M15 confirme + H1 accélère
    if (dslope_m15 < 0 && dslope_h1 < 0) return "SELL";

    return null;
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

    // Per-asset reversal kill switch
    const riskCfg = getRiskConfig(symbol);
    if (riskCfg.reversalEnabled === false) return [];

    const scoreMin = num(opts.scoreMin) ?? 0;
    const debug    = Boolean(opts.debug);

    const opps = [];
    const d = { total: 0, signals: 0 };

    for (let i = 0; i < data.length; i++) {
      d.total++;

      const dyn = getH1Dynamics(data[i]);
      if (!dyn) continue;

      const signalType = detectBuyExtreme(data[i], dyn)
                      ?? detectSellExtreme(data[i], dyn)
                      ?? detectBuyNear(data[i], dyn)
                      ?? detectSellNear(data[i], dyn);
      if (!signalType) continue;

      const side = signalType.startsWith("BUY") ? "BUY" : "SELL";
      const score = 80;

      if (score < scoreMin) continue;

      d.signals++;

      opps.push({
        type:       "REVERSAL",
        regime:     side === "BUY" ? "REVERSAL_BUY" : "REVERSAL_SELL",
        index:      i,
        timestamp:  data[i]?.timestamp,
        symbol,
        side,
        signalType,
        score,

        rsi_h1:    num(data[i]?.rsi_h1),
        slope_h1:  dyn.slope,
        dslope_h1: dyn.dslope,
        dz_h1:     dyn.dbbz,
        atr_h1:    num(data[i]?.atr_h1),
        zscore_h1: num(data[i]?.zscore_h1),
        zscore_m5: num(data[i]?.zscore_m5),
        rsi_m5:    num(data[i]?.rsi_m5),
        slope_m5:  num(data[i]?.slope_m5),
        dslope_m5: num(data[i]?.dslope_m5),
        drsi_m5:   num(data[i]?.drsi_m5),
      });
    }

    if (debug) console.info("REVERSAL REPORT", d);

    return opps;
  }

  return { evaluate };

})();

export default ReversalStrategy;
