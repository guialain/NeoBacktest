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

// =========================================================
// MICRO M5 CONTRARY — NEO MATRIX FINAL
// Bloque :
// 1) spike terminal
// 2) pullback actif
// 3) slope insuffisant pour continuation
// =========================================================

function isM5Contrary(opp, side) {

  const rsi    = num(opp?.rsi_m5);
  const drsi   = num(opp?.drsi_m5);
  const slope  = num(opp?.slope_m5);
  const dslope = num(opp?.dslope_m5);

  if (
    rsi === null ||
    drsi === null ||
    slope === null ||
    dslope === null
  )
    return false;


  // =====================================================
  // BUY BLOCK CONDITIONS
  // =====================================================

  if (side === "BUY") {

    // spike terminal
    if (rsi > 60 && drsi > 5)
      return true;

    // pullback actif
    if (slope < -0.1 && dslope < 0)
      return true;

    // NEW — slope insuffisant
    if (slope < 0.5)
      return true;

  }


  // =====================================================
  // SELL BLOCK CONDITIONS
  // =====================================================

  if (side === "SELL") {

    if (rsi < 40 && drsi < -5)
      return true;

    if (slope > 0.1 && dslope > 0)
      return true;

    // NEW — slope insuffisant
    if (slope > -0.75)
      return true;

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

  // NEW — block pullback active
  if (isM5Contrary(opp, side)) {

    waitOpportunities.push({
      ...opp,
      state: "WAIT_M5_PULLBACK"
    });

    continue;

  }

  if (isM5Overextended(opp, side)) {

    waitOpportunities.push({
      ...opp,
      state: "WAIT_M5_OVEREXTENDED"
    });

    continue;

  }

}
      // reversal path
      else {
        if (isM5Contrary(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_MICRO" });
          continue;
        }

        if (isM5Overextended(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED" });
          continue;
        }

        if (isM1Contrary(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_M1_CONTRARY" });
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