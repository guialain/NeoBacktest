// ============================================================================
// TopOpportunities.js — NEO MATRIX v7 — H4 + H1 ROUTER
// Rôle: générer les candidats "opportunities" (BRUTS) à partir du marché,
// puis laisser SignalFilters.js faire VALID / WAIT.
//
// Détection: drsi_h4 (seuil ±1), dslope_h1 (seuil ±1),
//            rsi_h1 (zone), zscore_h1 (BB), prevLow3/High3 (contexte)
// Filtrage M5: délégué à SignalFilters.js
//
// 12 routes RSI-first (v7.4 — full 0-100 coverage):
//   REVERSAL  BUY  [0-25]  [25-30]  [30-35]
//   CONT      SELL [30-35] [35-50]  |  BUY [35-50]
//   CONT      BUY  [50-65] |  SELL [50-65]
//   CONT      BUY  [65-70]
//   REVERSAL  SELL [65-70]  [70-75]  [75-100]
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";

const TopOpportunities = (() => {

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
  // 12-ROUTE MATCHER (v7.4)
  // =========================
  // Uses: rsi_h1, drsi_h4 (±1), dslope_h1 (±1/±2), drsi_h1 (±1 on [30-35]/[65-70]), zscore_h1, prevLow3/prevHigh3
  // Full 0-100 RSI coverage with extreme reversal zones restored
  function matchRoute(rsi, drsi_h4, slope_h1, dslope_h1, drsi_h1, zscore_h1, prevLow3, prevHigh3) {
    if (rsi === null || drsi_h4 === null || dslope_h1 === null || zscore_h1 === null)
      return null;

    // ── REVERSAL BUY (bas) ────────────────────────────────────────────
    // [0-25] Extreme oversold: RSI H4 monte, H1 rebondit fort, BB extrême
    if (rsi < 25
     && drsi_h4 > 0
     && dslope_h1 > 1.5
     && zscore_h1 < -2.5)
      return { route: "BUY-R-[0-25]", side: "BUY", type: "REVERSAL" };

    // [25-30] Oversold: RSI H4 monte, H1 accélère fort, RSI H1 monte
    if (rsi >= 25 && rsi < 30
     && drsi_h4 > 0
     && dslope_h1 > 1.5
     && drsi_h1 !== null && drsi_h1 > 0.5
     && zscore_h1 < -2.0)
      return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };

    // [30-35] Reversal confirmed: RSI H4 monte, H1 accélère, RSI H1 monte, vient d'un vrai creux
    if (rsi >= 30 && rsi < 35
     && drsi_h4 > 0
     && dslope_h1 > 1
     && drsi_h1 !== null && drsi_h1 > 0.5
     && zscore_h1 < -0.8
     && prevLow3 !== null && prevLow3 < 30)
      return { route: "BUY-R-[30-35]", side: "BUY", type: "REVERSAL" };

    // ── CONTINUATION SELL (zone basse) ────────────────────────────────
    // [30-35] Trend baissier: RSI H4 baisse, slope H1 baissier, RSI H1 baisse
    if (rsi >= 30 && rsi < 35
     && drsi_h4 < 0
     && slope_h1 !== null && slope_h1 < -1
     && dslope_h1 < -1
     && drsi_h1 !== null && drsi_h1 < -0.5
     && zscore_h1 < -0.5)
      return { route: "SELL-C-[30-35]", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION zone médiane [35-50] ─────────────────────────────
    // BUY: RSI H4 monte, slope H1 haussier, H1 accélère, RSI H1 monte
    if (rsi >= 35 && rsi < 50
     && drsi_h4 > 0
     && slope_h1 !== null && slope_h1 > 1
     && dslope_h1 > 1
     && drsi_h1 !== null && drsi_h1 > 0.5
     && zscore_h1 < 0.5)
      return { route: "BUY-C-[35-50]", side: "BUY", type: "CONTINUATION" };

    // SELL: RSI H4 baisse, slope H1 baissier, H1 décélère, RSI H1 baisse
    if (rsi >= 35 && rsi < 50
     && drsi_h4 < 0
     && slope_h1 !== null && slope_h1 < -1
     && dslope_h1 < -1
     && drsi_h1 !== null && drsi_h1 < -0.5
     && zscore_h1 > -0.5)
      return { route: "SELL-C-[35-50]", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION zone médiane [50-65] ─────────────────────────────
    // BUY: RSI H4 monte, slope H1 haussier, H1 accélère, RSI H1 monte
    if (rsi >= 50 && rsi < 65
     && drsi_h4 > 0
     && slope_h1 !== null && slope_h1 > 1
     && dslope_h1 > 1
     && drsi_h1 !== null && drsi_h1 > 1
     && zscore_h1 < 1.5)
      return { route: "BUY-C-[50-65]", side: "BUY", type: "CONTINUATION" };

    // SELL: RSI H4 baisse, slope H1 baissier, H1 décélère, RSI H1 baisse
    if (rsi >= 50 && rsi < 65
     && drsi_h4 < 0
     && slope_h1 !== null && slope_h1 < -1
     && dslope_h1 < -1
     && drsi_h1 !== null && drsi_h1 < -1
     && zscore_h1 > -1.5)
      return { route: "SELL-C-[50-65]", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION zone haute [65-70] ───────────────────────────────
    // BUY: RSI H4 monte, slope H1 haussier, H1 accélère, RSI H1 monte
    if (rsi >= 65 && rsi < 70
     && drsi_h4 > 0
     && slope_h1 !== null && slope_h1 > 1
     && dslope_h1 > 1
     && drsi_h1 !== null && drsi_h1 > 0.5
     && zscore_h1 < 1.5)
      return { route: "BUY-C-[65-70]", side: "BUY", type: "CONTINUATION" };

    // ── REVERSAL SELL (haut) ──────────────────────────────────────────
    // [65-70] Confirmed: RSI H4 baisse, H1 décroche, RSI H1 baisse, pic récent élevé
    if (rsi >= 65 && rsi < 70
     && drsi_h4 < 0
     && dslope_h1 < -1
     && drsi_h1 !== null && drsi_h1 < -0.5
     && zscore_h1 > 0.8
     && prevHigh3 !== null && prevHigh3 > 70)
      return { route: "SELL-R-[65-70]", side: "SELL", type: "REVERSAL" };

    // [70-75] Strong: RSI H4 baisse, H1 retourne, RSI H1 baisse
    if (rsi >= 70 && rsi < 75
     && drsi_h4 < 0
     && dslope_h1 < -1
     && drsi_h1 !== null && drsi_h1 < -0.5
     && zscore_h1 > 2.0)
      return { route: "SELL-R-[70-75]", side: "SELL", type: "REVERSAL" };

    // [75-100] Extreme overbought: RSI H4 baisse, H1 fléchit fort, BB extrême
    if (rsi >= 75
     && drsi_h4 < 0
     && dslope_h1 < -1.5
     && zscore_h1 > 2.5)
      return { route: "SELL-R-[75-100]", side: "SELL", type: "REVERSAL" };

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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const match = matchRoute(
        num(row?.rsi_h1),
        num(row?.drsi_h4),
        num(row?.slope_h1),
        num(row?.dslope_h1),
        num(row?.drsi_h1),
        num(row?.zscore_h1),
        num(row?.rsi_h1_previouslow3),
        num(row?.rsi_h1_previoushigh3)
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
        index:      i,
        timestamp:  row?.timestamp,
        symbol,
        side:       match.side,
        signalType: match.side,
        score,

        // H4
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
      console.info("TOPOPP v7 12-ROUTE", {
        total_rows: rows.length,
        signals:    opps.length,
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities;
