// ============================================================================
// SignalFilters.js — M5 MICRO CONTRARY FILTER (v2.2)
// ============================================================================

import { getAssetConfig } from "../config/AssetConfig";

const SignalFilters = (() => {

  const THRESHOLDS = {
    BUY: {
      slope_veto: -0.1,
      dslope: -0.10,
      drsi_veto: -1.0,
      drsi: -0.1,
      rsi_max: 61
    },
    SELL: {
      slope_veto: 0.1,
      dslope: 0.10,
      drsi_veto: 1.0,
      drsi: 0.1,
      rsi_min: 39
    }
  };

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================================================
  // VOLATILITY FILTER (H1)
  // =========================================================
  function isLowVolatility(opp) {

    const atr    = num(opp?.atr_h1);
    const close  = num(opp?.close);
    const symbol = opp?.symbol;

    if (!symbol) return true;

    const assetCfg = getAssetConfig(symbol);
    const minRatio = assetCfg?.volatility?.minRatio;

    if (!Number.isFinite(atr) || !Number.isFinite(close)) return true;
    if (!Number.isFinite(minRatio)) return false;

    const volRatio = atr / close;

    return volRatio < minRatio;
  }

  // =========================================================
  // MICRO M5 FILTER
  // =========================================================
  function isM5Contrary(opp, side) {

    const slope  = num(opp?.slope_m5);
    const dslope = num(opp?.dslope_m5);
    const drsi   = num(opp?.drsi_m5);
    const rsi    = num(opp?.rsi_m5);

    if (slope == null || dslope == null || drsi == null || rsi == null)
      return true;

    const t = THRESHOLDS[side];
    if (!t) return true;

    if (side === "BUY") {

      if (rsi > t.rsi_max) return true;

      if (slope < t.slope_veto) return true;

      if (dslope < t.dslope && drsi < t.drsi)
        return true;

      if (drsi < t.drsi_veto)
        return true;
    }

    if (side === "SELL") {

      if (rsi < t.rsi_min) return true;

      if (slope > t.slope_veto) return true;

      if (dslope > t.dslope && drsi > t.drsi)
        return true;

      if (drsi > t.drsi_veto)
        return true;
    }

    return false;
  }

  // =========================================================
// MICRO M5 MOMENTUM FLOOR (nouveau)
// =========================================================
function isM5WeakMomentum(opp, side) {

  const slope  = num(opp?.slope_m5);
  const dslope = num(opp?.dslope_m5);

  if (slope == null || dslope == null)
    return true;

  if (side === "BUY") {
    // pente trop faible ou pas d'accélération
    if (slope < 0.5) return true;
    if (dslope <= 0) return true;
  }

  if (side === "SELL") {
    if (slope > -0.5) return true;
    if (dslope >= 0) return true;
  }

  return false;
}

  // =========================================================
  // MAIN EVALUATE
  // =========================================================
  function evaluate({ opportunities } = {}) {

    const opps = Array.isArray(opportunities) ? opportunities : [];

    const validOpportunities = [];
    const waitOpportunities  = [];

    for (const opp of opps) {

      const index = num(opp?.index);
      const side  = (opp?.side === "BUY" || opp?.side === "SELL") ? opp.side : null;

      if (!Number.isFinite(index) || !side) {
        waitOpportunities.push(opp);
        continue;
      }

      // 1️⃣ VOLATILITY
      if (isLowVolatility(opp)) {
        waitOpportunities.push({ ...opp, state: "WAIT_LOW_VOL" });
        continue;
      }

      // 2️⃣ MICRO M5
      if (isM5Contrary(opp, side)) {
        waitOpportunities.push({ ...opp, state: "WAIT_MICRO" });
        continue;
      }

// 3️⃣ MICRO MOMENTUM FLOOR (nouveau)
if (isM5WeakMomentum(opp, side)) {
  waitOpportunities.push({ ...opp, state: "WAIT_WEAK_M5" });
  continue;
}

      validOpportunities.push({ ...opp, state: "VALID" });
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters;