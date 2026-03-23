// ============================================================================
// TopOpportunities.js — NEO MATRIX (vNext RSI-ROUTED ORCHESTRATOR) — REVISED
// Rôle: générer les candidats "opportunities" (BRUTS) à partir du marché,
// puis laisser SignalFilters.js faire VALID / WAIT.
//
// RSI-first routing (per bar, based on rsi_h1):
// - RSI ∈ [0..25)   => EXTREME_OVERSOLD   → reversal only
// - RSI ∈ [25..30)  => OVERSOLD            → reversal only
// - RSI ∈ [30..35)  => OVERSOLD_NEAR       → continuation zone 1
// - RSI ∈ [35..48)  => TRANSITION_LOW      → continuation zone 2
// - RSI ∈ [48..52)  => NEUTRAL             → skip
// - RSI ∈ [52..65)  => TRANSITION_HIGH     → continuation zone 2
// - RSI ∈ [65..70)  => OVERBOUGHT_NEAR     → continuation zone 1
// - RSI ∈ [70..75)  => OVERBOUGHT          → reversal only
// - RSI ∈ [75..100] => EXTREME_OVERBOUGHT  → reversal only
//
// Notes:
// - Conserve un format unique d'opportunity pour SignalFilters/tradeSimulator.
// - Dédoublonnage / spacing optionnels (recommandé pour éviter spam).
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
  // 12-ROUTE MATCHER
  // =========================
  // Returns { route, side, type } or null
  function matchRoute(rsi, slope_h1, dslope_h1, slope_m15, dslope_m15, zscore_h1) {
    if (rsi === null || slope_h1 === null || dslope_h1 === null || dslope_m15 === null)
      return null;

    // ── REVERSAL BUY (bas) ────────────────────────────────────────────
    // [0-25] Extreme: marché en chute extrême sur H1+M15, les deux ralentissent
    if (rsi < 25
     && slope_h1 < -7 && slope_m15 !== null && slope_m15 < -2
     && dslope_h1 > 0 && dslope_m15 > 0)
      return { route: "BUY-R-[0-25]", side: "BUY", type: "REVERSAL" };

    // [25-30] Strong: H1 encore baissier mais plus en extrême, décélère
    if (rsi >= 25 && rsi < 30
     && slope_h1 > -3
     && dslope_h1 > 0 && dslope_m15 > 0)
      return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };

    // [30-35] Confirmed: H1 a tourné positif, M15 confirme
    if (rsi >= 30 && rsi < 35
     && slope_h1 > 1.0
     && dslope_h1 > 0 && dslope_m15 > 0)
      return { route: "BUY-R-[30-35]", side: "BUY", type: "REVERSAL" };

    // ── CONTINUATION SELL (zone basse) ────────────────────────────────
    // [30-35] trend baissier établi, RSI encore bas
    if (rsi >= 30 && rsi < 35
     && slope_h1 <= -2.0
     && dslope_h1 < 0 && dslope_m15 < 0
     && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
      return { route: "SELL-C-[30-35]", side: "SELL", type: "CONTINUATION" };

    // [35-48] prix vient du haut, RSI en baisse
    if (rsi >= 35 && rsi < 48
     && slope_h1 <= -1.5
     && dslope_h1 < 0 && dslope_m15 < 0
     && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
      return { route: "SELL-C-[35-48]", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION BUY/SELL (zone centrale) ─────────────────────────
    // [35-48] BUY: RSI se reprend, slope haussier
    if (rsi >= 35 && rsi < 48
     && slope_h1 >= 1.0
     && dslope_h1 > 0 && dslope_m15 > 0
     && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
      return { route: "BUY-C-[35-48]", side: "BUY", type: "CONTINUATION" };

    // [52-65] BUY: RSI monte, slope haussier
    if (rsi >= 52 && rsi < 65
     && slope_h1 >= 1.5
     && dslope_h1 > 0 && dslope_m15 > 0
     && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
      return { route: "BUY-C-[52-65]", side: "BUY", type: "CONTINUATION" };

    // [52-65] SELL: RSI descend du haut, slope baissier
    if (rsi >= 52 && rsi < 65
     && slope_h1 <= -1.0
     && dslope_h1 < 0 && dslope_m15 < 0
     && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
      return { route: "SELL-C-[52-65]", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION BUY (zone haute) ─────────────────────────────────
    // [65-70] RSI haut, prix monte encore
    if (rsi >= 65 && rsi < 70
     && slope_h1 >= 2.0
     && dslope_h1 > 0 && dslope_m15 > 0
     && zscore_h1 !== null && Math.abs(zscore_h1) >= 0.3)
      return { route: "BUY-C-[65-70]", side: "BUY", type: "CONTINUATION" };

    // ── REVERSAL SELL (haut) ──────────────────────────────────────────
    // [65-70] Confirmed: H1 a tourné négatif, M15 confirme
    if (rsi >= 65 && rsi < 70
     && slope_h1 < -1.0
     && dslope_h1 < 0 && dslope_m15 < 0)
      return { route: "SELL-R-[65-70]", side: "SELL", type: "REVERSAL" };

    // [70-75] Strong: H1 encore haussier mais plus en extrême, décélère
    if (rsi >= 70 && rsi < 75
     && slope_h1 > 3.0
     && dslope_h1 < 0 && dslope_m15 < 0)
      return { route: "SELL-R-[70-75]", side: "SELL", type: "REVERSAL" };

    // [75-100] Extreme: marché en hausse extrême sur H1+M15, les deux ralentissent
    if (rsi >= 75
     && slope_h1 > 7.0 && slope_m15 !== null && slope_m15 > 2
     && dslope_h1 < 0 && dslope_m15 < 0)
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
        num(row?.slope_h1),
        num(row?.dslope_h1),
        num(row?.slope_m15),
        num(row?.dslope_m15),
        num(row?.zscore_h1)
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

        rsi_h1:     num(row?.rsi_h1),
        slope_h1:   num(row?.slope_h1),
        dslope_h1:  num(row?.dslope_h1),
        dz_h1:      num(row?.dz_h1),
        zscore_h1:  num(row?.zscore_h1),
        atr_h1:     num(row?.atr_h1),
        atr_m15:    num(row?.atr_m15),
        close:      num(row?.close),

        rsi_m15:    num(row?.rsi_m15),
        slope_m15:  num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

        rsi_m5:     num(row?.rsi_m5),
        slope_m5:   num(row?.slope_m5),
        dslope_m5:  num(row?.dslope_m5),
        drsi_m5:    num(row?.drsi_m5),
        zscore_m5:  num(row?.zscore_m5),

        rsi_m1:     num(row?.rsi_m1),
        drsi_m1:    num(row?.drsi_m1),

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
      console.info("TOPOPP 12-ROUTE", {
        total_rows: rows.length,
        signals:    opps.length,
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities;