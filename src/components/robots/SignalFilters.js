// ============================================================================
// SignalFilters.js — M5 MICRO CONTRARY FILTER (v2.5)
// ✅ Compatible VolatilityEngine.js
// Régimes : low | med | high | explo
//
// Politique recommandée :
//   BLOCK : low, explo
//   ALLOW : med, high
// ============================================================================

import { getVolatilityRegime } from "./VolatilityEngine";
import { TIMING_CONFIG } from "../config/TimingConfig";

const SignalFilters = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================================================
  // TRADING HOURS FILTER
  // =========================================================
  function isOutsideTradingHours(opp) {
    const ts = opp?.timestamp;
    if (!ts) return false;

    const [datePart, timePart] = ts.split(" ");
    if (!datePart || !timePart) return false;

    const symbol = String(opp?.symbol ?? "").toUpperCase();
    const hours  = TIMING_CONFIG.tradingHours?.[symbol]
                ?? TIMING_CONFIG.tradingHours?.default;
    if (!hours) return false;

    return timePart < hours.start || timePart >= hours.end;
  }

  // =========================================================
  // WEEKEND FILTER
  // =========================================================
  function isWeekendRisk(opp) {
    const ts = opp?.timestamp;
    if (!ts) return false;

    const [datePart, timePart] = ts.split(" ");
    if (!datePart || !timePart) return false;

    const d = new Date(`${datePart.replace(/\./g, "-")}T${timePart}:00`);
    if (isNaN(d.getTime())) return false;

    const day  = d.getDay();
    const hour = d.getHours();

    if (day === 6 || day === 0) return true;
    if (day === 5 && hour >= TIMING_CONFIG.weekendFridayHour) return true;

    return false;
  }

  // =========================================================
  // VOLATILITY FILTER — MATCH VolatilityEngine
  // =========================================================
  function getRegime(opp) {
    return getVolatilityRegime(
      opp?.symbol,
      opp?.atr_m15,
      opp?.close
    ); // null | low | med | high | explo
  }

  function isBlockedVolatility(regime) {
    if (!regime) return false;
    if (regime === "low")   return true;
    // explo : laissé passer (aligné Matrix)
    return false;
  }


  // =========================================================
  // M5 CONTRARY — momentum opposé au signal H1
  // =========================================================
  function isM5Contrary(opp, side) {
    const slope  = num(opp?.slope_m5);
    const dslope = num(opp?.dslope_m5);
    const drsi   = num(opp?.drsi_m5);

    if (slope === null || dslope === null || drsi === null) return false;

    const TH = TIMING_CONFIG.M5.slopeThreshold;

    if (side === "BUY") {
      if (slope < 0 && dslope < 0 && drsi < 0) return true;
      if (dslope < 0 && drsi < 0) return true;
      const slopeWeak = slope < TH;
      const microWeak = dslope < 0 || drsi < 0;
      if (slopeWeak && microWeak) return true;
    }

    if (side === "SELL") {
      if (slope > 0 && dslope > 0 && drsi > 0) return true;
      if (dslope > 0 && drsi > 0) return true;
      const slopeWeak = slope > -TH;
      const microWeak = dslope > 0 || drsi > 0;
      if (slopeWeak && microWeak) return true;
    }

    return false;
  }

  // =========================================================
  // M5 OVEREXTENDED — prix/momentum trop étiré
  // =========================================================
  function isM5Overextended(opp, side) {
    const rsi    = num(opp?.rsi_m5);
    const drsi   = num(opp?.drsi_m5);
    const slope  = num(opp?.slope_m5);
    const dslope = num(opp?.dslope_m5);
    const zh1    = num(opp?.zscore_h1);
    const zm5    = num(opp?.zscore_m5);

    const oe = TIMING_CONFIG.M5.overextended;

    if (side === "BUY") {
      // MTF extension block
      if ((zh1 !== null && zh1 > 1.8) || (zm5 !== null && zm5 > 1.8)) return true;
      // spike terminal RSI
      if (rsi !== null && drsi !== null && rsi > 65 && drsi > 5) return true;
      // TimingConfig thresholds
      if (rsi !== null && slope !== null && dslope !== null && drsi !== null) {
        if (rsi > oe.rsiMax || slope > oe.slopeAbs || dslope > oe.dslopeAbs || drsi > oe.drsiAbs)
          return true;
      }
    }

    if (side === "SELL") {
      // MTF extension block
      if ((zh1 !== null && zh1 < -1.8) || (zm5 !== null && zm5 < -1.8)) return true;
      // spike terminal RSI
      if (rsi !== null && drsi !== null && rsi < 35 && drsi < -5) return true;
      // TimingConfig thresholds
      if (rsi !== null && slope !== null && dslope !== null && drsi !== null) {
        if (rsi < oe.rsiMin || slope < -oe.slopeAbs || dslope < -oe.dslopeAbs || drsi < -oe.drsiAbs)
          return true;
      }
    }

    return false;
  }

  // =========================================================
  // M1 CONTRARY — CLEAN RSI ONLY
  // =========================================================
  function isM1Contrary(opp, side) {
    const rsi  = num(opp?.rsi_m1);
    const drsi = num(opp?.drsi_m1);

    if (rsi === null || drsi === null) return false;

    // BUY: micro spike haussier terminal (trop tard pour BUY)
    if (side === "BUY" && rsi > 63 && drsi > 0.5) return true;

    // SELL: micro spike baissier terminal (trop tard pour SELL)
    if (side === "SELL" && rsi < 37 && drsi < -0.5) return true;

    return false;
  }

  // =========================================================
  // MAIN
  // =========================================================
  function evaluate({ opportunities } = {}) {
    const opps = Array.isArray(opportunities) ? opportunities : [];

    const validOpportunities = [];
    const waitOpportunities  = [];

    for (const opp of opps) {
      const side = opp?.side;
      if (!side) continue;

      const type = String(opp?.type ?? "").toUpperCase();
      const isContinuation = type === "CONTINUATION";
      // reversal = everything else (REVERSAL, empty, legacy "reversal", etc.)


      // 1. trading hours — EN PREMIER
      if (isOutsideTradingHours(opp)) {
        waitOpportunities.push({ ...opp, state: "WAIT_OUTSIDE_HOURS" });
        continue;
      }

      // 2. weekend
      if (isWeekendRisk(opp)) {
        waitOpportunities.push({ ...opp, state: "WAIT_WEEKEND" });
        continue;
      }

      // volatility
      const regime = getRegime(opp);
      if (isBlockedVolatility(regime)) {
        waitOpportunities.push({ ...opp, state: `WAIT_VOL_${regime}` });
        continue;
      }

     // continuation path
if (isContinuation) {

  // M5 is contrary to H1 signal
const m5Block = isM5Contrary(opp, side);
if (m5Block) {
  waitOpportunities.push({ ...opp, state: "WAIT_M5_CONTRARY" });
  continue;
}

// M5 is overextended
  if (isM5Overextended(opp, side)) {
    waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED" });
    continue;
  }

  // M1 micro spike
  if (isM1Contrary(opp, side)) {
    waitOpportunities.push({ ...opp, state: "WAIT_M1_CONTRARY" });
    continue;
  }

}

// =========================================================
// REVERSAL PATH
// =========================================================
else {

  const isZmid = String(opp?.signalType ?? "").includes("ZMID");
  const TH   = TIMING_CONFIG.M5.slopeThreshold;
  const sm5  = num(opp?.slope_m5);
  const dsm5 = num(opp?.dslope_m5);
  const zm5  = num(opp?.zscore_m5);   // ← zscore_m5, pas zscore_h1

  // =====================================================
  // ZM5 EXTENSION — bloque reversal si M5 déjà trop étiré
  // =====================================================
  if (side === "BUY"  && zm5 !== null && zm5 > 1.8) {
    waitOpportunities.push({ ...opp, state: "WAIT_ZM5_EXTENDED" });
    continue;
  }
  if (side === "SELL" && zm5 !== null && zm5 < -1.8) {
    waitOpportunities.push({ ...opp, state: "WAIT_ZM5_EXTENDED" });
    continue;
  }

  // =====================================================
  // M5 CONFIRMATION — transition gate (skip pour ZMID)
  // =====================================================
  if (!isZmid && sm5 !== null && dsm5 !== null) {

    // ===== BUY REVERSAL =====
    const slopeTooBearish = sm5 < -TH;  // franchement négatif
    const noMicroTurn     = dsm5 <= 0;    // pas d'amélioration

    if (side === "BUY" && slopeTooBearish && noMicroTurn) {
      waitOpportunities.push({
        ...opp,
        state: "WAIT_M5_CONFIRMATION"
      });
      continue;
    }

    // ===== SELL REVERSAL =====
    const slopeTooBullish = sm5 > TH;   // franchement positif
    const noMicroTurnSell = dsm5 >= 0;    // pas de retournement

    if (side === "SELL" && slopeTooBullish && noMicroTurnSell) {
      waitOpportunities.push({
        ...opp,
        state: "WAIT_M5_CONFIRMATION"
      });
      continue;
    }
  }

  // =====================================================
  // M5 CONTRARY — momentum opposé (skip pour ZMID)
  // =====================================================
  if (!isZmid && isM5Contrary(opp, side)) {
    waitOpportunities.push({
      ...opp,
      state: "WAIT_M5_CONTRARY"
    });
    continue;
  }

  // =====================================================
  // M5 OVEREXTENDED — prix/momentum trop étiré
  // =====================================================
  if (isM5Overextended(opp, side)) {
    waitOpportunities.push({
      ...opp,
      state: "WAIT_M5_OVEREXTENDED"
    });
    continue;
  }

  // =====================================================
  // M1 MICRO SPIKE
  // =====================================================
  if (isM1Contrary(opp, side)) {
    waitOpportunities.push({
      ...opp,
      state: "WAIT_M1_CONTRARY"
    });
    continue;
  }
}

      validOpportunities.push({
  ...opp,
  state: "VALID",
  volatilityRegime: regime ?? null
});
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters;