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
    if (regime === "explo") return true;
    return false;
  }


  const MICRO_SLOPE_THRESHOLD = 0.5;

  // =========================================================
  // M5 is contrary to H1 signal
  // =========================================================
function isM5Contrary(opp, side) {

  const rsi    = num(opp?.rsi_m5);
  const drsi   = num(opp?.drsi_m5);
  const slope  = num(opp?.slope_m5);
  const dslope = num(opp?.dslope_m5);

  const zh1 = num(opp?.zscore_h1);
  const zm5 = num(opp?.zscore_m5);

  if (rsi === null || drsi === null || slope === null || dslope === null)
    return false;

  // =====================================================
  // BUY
  // =====================================================
  if (side === "BUY") {

    // MTF extension block (trop tard)
    if (zh1 !== null && zm5 !== null && zh1 > 0.9 && zm5 > 0.8)
      return true;

    // spike terminal (RSI)
    if (rsi > 60 && drsi > 5)
      return true;

    // pullback actif confirmé
    if (slope < 0 && dslope < 0 && drsi < 0)
      return true;

    // continuation timing insuffisant
const slopeWeak = slope < MICRO_SLOPE_THRESHOLD;
const microWeak = dslope < 0 || drsi < 0;
if (slopeWeak && microWeak) {
  return true;
}

  }

  // =====================================================
  // SELL
  // =====================================================
  if (side === "SELL") {

    // MTF extension block (trop tard)
    if (zh1 !== null && zm5 !== null && zh1 < -0.9 && zm5 < -0.8)
      return true;

    if (rsi < 40 && drsi < -5)
      return true;

    if (slope > 0 && dslope > 0 && drsi > 0)
      return true;

const slopeWeak = slope > -MICRO_SLOPE_THRESHOLD;
const microWeak = dslope > 0 || drsi > 0;
if (slopeWeak && microWeak) {
  return true;
}

  }

  return false;
}
// =========================================================
// M5 OVEREXTENDED 
// Bloque les entrées continuation trop tardives
// =========================================================

function isM5Overextended(opp, side) {

  const slope  = num(opp?.slope_m5);
  const dslope = num(opp?.dslope_m5);
  const drsi   = num(opp?.drsi_m5);
  const rsi    = num(opp?.rsi_m5);

  if (
    slope === null ||
    dslope === null ||
    drsi === null ||
    rsi === null
  )
    return false;

  const oe = TIMING_CONFIG.M5.overextended;


  // =====================================================
  // BUY — spike terminal haussier
  // =====================================================

  if (side === "BUY") {

    // condition PRO : spike confirmé
    if (

      rsi   > oe.rsiMax     ||   // NEW critical filter
      slope > oe.slopeAbs   ||
      dslope > oe.dslopeAbs ||
      drsi > oe.drsiAbs

    )
      return true;

  }


  // =====================================================
  // SELL — spike terminal baissier
  // =====================================================

  if (side === "SELL") {

    if (

      rsi   < oe.rsiMin     ||   // NEW critical filter
      slope < -oe.slopeAbs  ||
      dslope < -oe.dslopeAbs||
      drsi < -oe.drsiAbs

    )
      return true;

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
    if (side === "BUY" && rsi > 65 && drsi > 0.5) return true;

    // SELL: micro spike baissier terminal (trop tard pour SELL)
    if (side === "SELL" && rsi < 35 && drsi < -0.5) return true;

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


      // trading hours
      if (isOutsideTradingHours(opp)) {
        waitOpportunities.push({ ...opp, state: "WAIT_OUTSIDE_HOURS" });
        continue;
      }

      // weekend
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

    waitOpportunities.push({
      ...opp,
      state: "WAIT_M5_OVEREXTENDED"
    });

    continue;

  }

}

// =========================================================
// REVERSAL PATH
// =========================================================
else {

  const sm5  = num(opp?.slope_m5);
  const dsm5 = num(opp?.dslope_m5);

  // =====================================================
  // M5 CONFIRMATION — transition gate
  // =====================================================
  if (sm5 !== null && dsm5 !== null) {

    // ===== BUY REVERSAL =====
    const slopeTooBearish = sm5 < -MICRO_SLOPE_THRESHOLD;   // franchement négatif
    const noMicroTurn     = dsm5 < 0;     // pas d'amélioration

    if (side === "BUY" && slopeTooBearish && noMicroTurn) {
      waitOpportunities.push({
        ...opp,
        state: "WAIT_M5_CONFIRMATION"
      });
      continue;
    }

    // ===== SELL REVERSAL =====
    const slopeTooBullish = sm5 > MICRO_SLOPE_THRESHOLD;    // franchement positif
    const noMicroTurnSell = dsm5 > 0;     // pas de retournement

    if (side === "SELL" && slopeTooBullish && noMicroTurnSell) {
      waitOpportunities.push({
        ...opp,
        state: "WAIT_M5_CONFIRMATION"
      });
      continue;
    }
  }

  // =====================================================
  // MICRO CONTRARY — uniquement hors zone grise [-TH, TH]
  // =====================================================
  if (Math.abs(sm5 ?? 0) >= MICRO_SLOPE_THRESHOLD && isM5Contrary(opp, side)) {
    waitOpportunities.push({
      ...opp,
      state: "WAIT_MICRO"
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