// ============================================================================
// SignalFilters.js — M5 ENTRY FILTER (v3)
// ✅ Compatible VolatilityEngine.js
// Régimes : low | med | high | explo
//
// Filtre post-détection H4+H1: vérifie le timing M5 avant entrée.
// M1 supprimé (plus dans le dataset).
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

    const blocked = (day === 6 || day === 0) || (day === 5 && hour >= TIMING_CONFIG.weekendFridayHour);

    return blocked;
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
    const rsi    = num(opp?.rsi_m5);
    const slope  = num(opp?.slope_m5);
    const drsi   = num(opp?.drsi_m5);
    const dslope = num(opp?.dslope_m5);

    if (side === "BUY") {
      if (rsi !== null && rsi > 65) return true;
      if (slope !== null && slope < -2) return true;
      if (drsi !== null && drsi < -1) return true;
      if (dslope !== null && dslope < -2.0) return true;
    }

    if (side === "SELL") {
      if (rsi !== null && rsi < 35) return true;
      if (slope !== null && slope > 2) return true;
      if (drsi !== null && drsi > 1) return true;
      if (dslope !== null && dslope > 2.0) return true;
    }

    return false;
  }

  // =========================================================
  // M5 OVEREXTENDED — prix/momentum trop étiré
  // =========================================================
  function isM5Overextended(opp, side) {
    const slope = num(opp?.slope_m5);
    const zm5   = num(opp?.zscore_m5);

    if (side === "BUY") {
      if (slope !== null && slope > 6) return true;
      if (zm5   !== null && zm5   > 1.8) return true;
    }

    if (side === "SELL") {
      if (slope !== null && slope < -6) return true;
      if (zm5   !== null && zm5   < -1.8) return true;
    }

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


      // 1. weekend
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

      // M5 contrary
      if (isM5Contrary(opp, side)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_CONTRARY" });
        continue;
      }

      // M5 overextended
      if (isM5Overextended(opp, side)) {
        waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED" });
        continue;
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