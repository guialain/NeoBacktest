// ============================================================================
// TopOpportunities_H1.js — H1-ONLY ROUTER (no H4 dependency)
// Clone de TopOpportunities.js v8 sans drsi_h4 ni slope_h4.
// Détection basée uniquement sur H1: slope_h1, dslope_h1, drsi_h1,
// zscore_h1, prevLow3/High3
//
// 18 routes RSI-first (SELL en notation décroissante):
//   REVERSAL  BUY  [0-25]  [25-30]  [30-35]
//   CONT      BUY  [35-50]-RET  [35-50]-BRK
//   CONT      BUY  [50-65]-RET  [50-65]-BRK
//   CONT      BUY  [65-70]-RET  [65-70]-BRK
//   CONT      SELL [65-50]-RET  [65-50]-BRK
//   CONT      SELL [50-35]-RET  [50-35]-BRK
//   CONT      SELL [35-30]-RET  [35-30]-BRK
//   REVERSAL  SELL [70-65]  [75-70]  [100-75]
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";

const TopOpportunities_H1 = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================
  // SPACING / DEDUPE
  // =========================
  function minutesBetween(tsA, tsB) {
    if (!tsA || !tsB) return null;
    const toDate = (ts) => {
      const [d, t] = String(ts).split(" ");
      if (!d || !t) return null;
      const dt = new Date(`${d.replace(/\./g, "-")}T${t}:00`);
      return isNaN(dt.getTime()) ? null : dt;
    };
    const a = toDate(tsA), b = toDate(tsB);
    if (!a || !b) return null;
    return Math.abs((a.getTime() - b.getTime()) / 60000);
  }

  function makeKey(opp) {
    return [opp?.symbol ?? "", opp?.route ?? "", opp?.side ?? ""].join("|");
  }

  function applyDedupeAndSpacing(opps, cfg) {
    const out = [];
    const seen = new Map();
    const minSpacingMin = num(cfg?.minSignalSpacingMinutes) ?? 0;
    const maxSignals    = num(cfg?.maxSignals) ?? Infinity;

    for (const opp of opps) {
      if (out.length >= maxSignals) break;
      const key = makeKey(opp);
      const lastTs = seen.get(key);
      if (minSpacingMin > 0 && lastTs) {
        const dt = minutesBetween(opp.timestamp, lastTs);
        if (dt !== null && dt < minSpacingMin) continue;
      }
      seen.set(key, opp.timestamp);
      out.push(opp);
    }
    return out;
  }

  // =========================
  // 18-ROUTE MATCHER — H1 ONLY
  // =========================
  function matchRoute(rsi, slope_h1, dslope_h1, drsi_h1, zscore_h1, prevLow3, prevHigh3, zscore_h1_min3, zscore_h1_max3) {
    if (rsi === null || dslope_h1 === null || zscore_h1 === null)
      return null;

    // ── REVERSAL BUY (bas) ────────────────────────────────────────────
    // [0-25] Extreme oversold (en live: drsi_h1_s0 pour réactivité)
    if (rsi < 25
     && drsi_h1 !== null && drsi_h1 > 0
     && dslope_h1 > 0.25
     && zscore_h1 < -0.3)
      return { route: "BUY-R-[0-25]", side: "BUY", type: "REVERSAL" };

    // [25-30] Oversold
    if (rsi >= 25 && rsi < 30
     && drsi_h1 !== null && drsi_h1 > 0.5
     && dslope_h1 > 0.25
     && zscore_h1 < -0.3)
      return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };

    // [30-35] Reversal confirmed
    if (rsi >= 30 && rsi < 35
     && slope_h1 !== null && slope_h1 > -2
     && drsi_h1 !== null && drsi_h1 > 0.5
     && dslope_h1 > 0.25
     && zscore_h1 < -0.8
     && prevLow3 !== null && prevLow3 < 30)
      return { route: "BUY-R-[30-35]", side: "BUY", type: "REVERSAL" };

    // ── CONTINUATION zone médiane [35-50] — RET / BRK ─────────────────

    // BUY-C-[35-50]-RET — SUPPRIMÉ (WR 10-27%, structurellement défaillant)

    // BUY-C-[35-50]-BRK — prix venait du bas, traverse [35-50] avec force
    if (rsi >= 35 && rsi < 50
     && slope_h1 !== null && slope_h1 > 1.5
     && drsi_h1 !== null && drsi_h1 > 1
     && dslope_h1 > 0.25
     && zscore_h1 > 0.3
     && zscore_h1 < 1.8
     && zscore_h1_min3 !== null && zscore_h1_min3 < -0.3
     && prevLow3 !== null && prevLow3 < 30)
      return { route: "BUY-C-[35-50]-BRK", side: "BUY", type: "CONTINUATION" };

    // ── CONTINUATION zone médiane [50-65] — RET / BRK ─────────────────

    // BUY-C-[50-65]-RET — retracement bounce (prix venait du haut)
    if (rsi >= 50 && rsi < 65
     && slope_h1 !== null && slope_h1 > -4.0
     && drsi_h1 !== null && drsi_h1 > 1
     && dslope_h1 > 0.25
     && zscore_h1 < 1.8
     && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5
     && prevHigh3 !== null && prevHigh3 > 65)
      return { route: "BUY-C-[50-65]-RET", side: "BUY", type: "CONTINUATION" };

    // BUY-C-[50-65]-BRK — breakout from below (prix monte depuis le bas)
    if (rsi >= 50 && rsi < 65
     && slope_h1 !== null && slope_h1 > 2.0
     && drsi_h1 !== null && drsi_h1 > 1
     && dslope_h1 > 0.25
     && zscore_h1 > 0.3
     && zscore_h1 < 1.8
     && zscore_h1_min3 !== null && zscore_h1_min3 < -0.3
     && prevLow3 !== null && prevLow3 < 50)
      return { route: "BUY-C-[50-65]-BRK", side: "BUY", type: "CONTINUATION" };

    // ── CONTINUATION zone haute [65-70] — RET / BRK ─────────────────

    // BUY-C-[65-70]-RET — retracement bounce (prix venait du haut)
    if (rsi >= 65 && rsi < 70
     && slope_h1 !== null && slope_h1 > -3.0
     && drsi_h1 !== null && drsi_h1 > 1
     && dslope_h1 > 0.25
     && zscore_h1 < 1.8
     && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5
     && prevHigh3 !== null && prevHigh3 > 70)
      return { route: "BUY-C-[65-70]-RET", side: "BUY", type: "CONTINUATION" };

    // BUY-C-[65-70]-BRK — breakout from below (prix monte depuis le bas)
    if (rsi >= 65 && rsi < 70
     && slope_h1 !== null && slope_h1 > 2.0
     && drsi_h1 !== null && drsi_h1 > 1
     && dslope_h1 > 0.25
     && zscore_h1 > 0.3
     && zscore_h1 < 1.8
     && zscore_h1_min3 !== null && zscore_h1_min3 < -0.3
     && prevLow3 !== null && prevLow3 < 65)
      return { route: "BUY-C-[65-70]-BRK", side: "BUY", type: "CONTINUATION" };

    // ── CONTINUATION SELL zone haute [65-50] — RET / BRK ────────────────

    // SELL-C-[65-50]-RET — retracement depuis le haut
    if (rsi >= 50 && rsi < 65
     && slope_h1 !== null && slope_h1 < 2.0
     && drsi_h1 !== null && drsi_h1 < -1
     && dslope_h1 < -0.25
     && zscore_h1 > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3
     && prevHigh3 !== null && prevHigh3 > 65)
      return { route: "SELL-C-[65-50]-RET", side: "SELL", type: "CONTINUATION" };

    // SELL-C-[65-50]-BRK — breakout from above (prix descend depuis le haut)
    if (rsi >= 50 && rsi < 65
     && slope_h1 !== null && slope_h1 < -1.5
     && drsi_h1 !== null && drsi_h1 < -1
     && dslope_h1 < -0.25
     && zscore_h1 < -0.3
     && zscore_h1 > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > 0.3
     && prevLow3 !== null && prevLow3 < 50)
      return { route: "SELL-C-[65-50]-BRK", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION SELL zone médiane [50-35] — RET / BRK ────────────────

    // SELL-C-[50-35]-RET — retracement depuis le haut
    if (rsi >= 35 && rsi < 50
     && slope_h1 !== null && slope_h1 < 4.0
     && drsi_h1 !== null && drsi_h1 < -1
     && dslope_h1 < -0.25
     && zscore_h1 > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3
     && prevHigh3 !== null && prevHigh3 > 35)
      return { route: "SELL-C-[50-35]-RET", side: "SELL", type: "CONTINUATION" };

    // SELL-C-[50-35]-BRK — breakout from above (prix descend depuis le haut)
    if (rsi >= 35 && rsi < 50
     && slope_h1 !== null && slope_h1 < -1.5
     && drsi_h1 !== null && drsi_h1 < -1
     && dslope_h1 < -0.25
     && zscore_h1 < -0.3
     && zscore_h1 > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > 0.3
     && prevHigh3 !== null && prevHigh3 > 50)
      return { route: "SELL-C-[50-35]-BRK", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION SELL zone basse [35-30] — RET / BRK ──────────────────

    // SELL-C-[35-30]-RET — retracement depuis le bas (venait du bas)
    if (rsi >= 30 && rsi < 35
     && slope_h1 !== null && slope_h1 < 3.0
     && drsi_h1 !== null && drsi_h1 < -1
     && dslope_h1 < -0.25
     && zscore_h1 > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 < 0.5
     && prevLow3 !== null && prevLow3 < 30)
      return { route: "SELL-C-[35-30]-RET", side: "SELL", type: "CONTINUATION" };

    // SELL-C-[35-30]-BRK — breakout from above
    if (rsi >= 30 && rsi < 35
     && slope_h1 !== null && slope_h1 < -2.0
     && drsi_h1 !== null && drsi_h1 < -1
     && dslope_h1 < -0.25
     && zscore_h1 < -0.3
     && zscore_h1 > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3
     && prevHigh3 !== null && prevHigh3 > 35)
      return { route: "SELL-C-[35-30]-BRK", side: "SELL", type: "CONTINUATION" };

    // ── REVERSAL SELL (haut) ──────────────────────────────────────────
    // [70-65] Confirmed — miroir de BUY-R-[30-35]
    if (rsi >= 65 && rsi < 70
     && slope_h1 !== null && slope_h1 < 2
     && drsi_h1 !== null && drsi_h1 < -0.5
     && dslope_h1 < -0.25
     && zscore_h1 > 0.8
     && prevHigh3 !== null && prevHigh3 > 70)
      return { route: "SELL-R-[70-65]", side: "SELL", type: "REVERSAL" };

    // [75-70] Overbought
    if (rsi >= 70 && rsi < 75
     && slope_h1 !== null && slope_h1 < 2
     && drsi_h1 !== null && drsi_h1 < -0.5
     && dslope_h1 < -0.25
     && zscore_h1 > 0.3)
      return { route: "SELL-R-[75-70]", side: "SELL", type: "REVERSAL" };

    // [100-75] Extreme overbought (en live: drsi_h1_s0 pour réactivité)
    if (rsi >= 75
     && drsi_h1 !== null && drsi_h1 < 0
     && dslope_h1 < -0.25
     && zscore_h1 > 0.3)
      return { route: "SELL-R-[100-75]", side: "SELL", type: "REVERSAL" };

    return null;
  }

  // =========================
  // MAIN
  // =========================
  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const symbol = rows[0]?.symbol;
    if (!symbol) return [];

    const riskCfg = getRiskConfig(symbol);
    const TOP_CFG = {
      minSignalSpacingMinutes: num(opts?.minSignalSpacingMinutes) ?? 0,
      maxSignals:              num(opts?.maxSignals) ?? Infinity,
      scoreMin: num(opts?.scoreMin) ?? 0,
      debug: Boolean(opts?.debug),
    };

    let opps = [];

    const atrH1Cap = num(riskCfg?.atrH1Cap);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Veto anti-spike : ATR H1 > 2× cap → skip bar
      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 2 * atrH1Cap) continue;

      const match = matchRoute(
        num(row?.rsi_h1),
        num(row?.slope_h1),
        num(row?.dslope_h1),
        num(row?.drsi_h1),
        num(row?.zscore_h1),
        num(row?.rsi_h1_previouslow3),
        num(row?.rsi_h1_previoushigh3),
        num(row?.zscore_h1_min3),
        num(row?.zscore_h1_max3)
      );
      if (!match) continue;

      // Reversal kill switch
      if (match.type === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      const score = match.type === "REVERSAL" ? 80 : Math.max(0, Math.round(
        Math.abs(num(row?.slope_h1) ?? 0) * 50 +
        Math.abs((num(row?.rsi_h1) ?? 50) - 50) * 2
      ));

      if (score < TOP_CFG.scoreMin) continue;

      opps.push({
        type:       match.type,
        regime:     `${match.type}_${match.side}`,
        route:      match.route,
        engine:     "H1",
        index:      i,
        timestamp:  row?.timestamp,
        symbol,
        side:       match.side,
        signalType: match.side,
        score,

        // H4 (passthrough for stats, not used in routing)
        slope_h4:   num(row?.slope_h4),
        dslope_h4:  num(row?.dslope_h4),

        // H1
        rsi_h1:     num(row?.rsi_h1),
        slope_h1:   num(row?.slope_h1),
        dslope_h1:  num(row?.dslope_h1),
        zscore_h1:  num(row?.zscore_h1),
        dz_h1:      num(row?.dz_h1),
        atr_h1:     num(row?.atr_h1),
        rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
        rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
        zscore_h1_min3: num(row?.zscore_h1_min3),
        zscore_h1_max3: num(row?.zscore_h1_max3),

        // M15 (for SignalFilters)
        atr_m15:    num(row?.atr_m15),
        rsi_m15:    num(row?.rsi_m15),
        slope_m15:  num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

        // M5 (for SignalFilters)
        rsi_m5:     num(row?.rsi_m5),
        slope_m5:   num(row?.slope_m5),
        dslope_m5:  num(row?.dslope_m5),
        drsi_m5:    num(row?.drsi_m5),
        zscore_m5:  num(row?.zscore_m5),

        // M1 (for SignalFilters)
        rsi_m1:     num(row?.rsi_m1),
        drsi_m1:    num(row?.drsi_m1),

        close:      num(row?.close),
        intraday_change: num(row?.intraday_change),
      });
    }

    // Sort: score desc, then latest timestamp
    opps.sort((a, b) => {
      const sa = a.score ?? 0, sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""));
    });

    // Dedupe/spacing
    opps = applyDedupeAndSpacing(opps, TOP_CFG);

    if (TOP_CFG.debug) {
      console.info("TOPOPP H1-ONLY", {
        total_rows: rows.length,
        signals:    opps.length,
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_H1;
