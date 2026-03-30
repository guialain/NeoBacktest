// ============================================================================
// TopOpportunities_REVERSAL_LAB.js — REVERSAL-ONLY LAB ENGINE
// Refonte from scratch basée sur les données corrigées (mars 2026)
//
// Principes :
// - RSI extrêmes seuls ne prédisent rien (~50% WR)
// - L'edge vient des combinaisons : dslope > 3.5, drsi > 7, prevLow3 < 18
// - Pas de zones [0-25] / [75-100] (marché sous forte pression)
// - Double condition zscore : min3/max3 (creux/pic récent) + courant
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";

const TopOpportunities_REVERSAL_LAB = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================
  // SPACING / DEDUPE
  // =========================
  function minutesBetween(tsA, tsB) {
    if (!tsA || !tsB) return null;
    const toDate = (ts) => {
      const [d, t] = String(ts).split(" ");
      if (!d || !t) return null;
      return new Date(`${d.replace(/\./g, "-")}T${t}:00`);
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
  // REVERSAL ROUTE MATCHER — LAB (zscore only)
  // =========================
  function matchRoute(rsi, slope_h1, dslope_h1, drsi_h1, zscore_h1, prevLow3, prevHigh3, zscore_h1_min3, zscore_h1_max3, rsi_m5) {
    if (zscore_h1 === null) return null;

    // ── BUY REVERSAL ────────────────────────────────────────────────
    // [0-25] Extreme oversold — RSI est le plus haut des 3 (remonte)
    if (rsi !== null && rsi < 25
     && zscore_h1 < -2.5
     && zscore_h1_min3 !== null && zscore_h1 > zscore_h1_min3)
      return { route: "BUY-R-[0-25]", side: "BUY", type: "REVERSAL" };

    // [25-30] Oversold
    if (rsi !== null && rsi >= 25 && rsi < 30
     && zscore_h1 < -2.5
     && zscore_h1_min3 !== null && zscore_h1 > zscore_h1_min3)
      return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };

    // ── SELL REVERSAL ───────────────────────────────────────────────
    // [70-75] Overbought — RSI est le plus bas des 3 (redescend)
    if (rsi !== null && rsi >= 70 && rsi < 75
     && zscore_h1 > 2.5
     && zscore_h1_max3 !== null && zscore_h1 < zscore_h1_max3)
      return { route: "SELL-R-[70-75]", side: "SELL", type: "REVERSAL" };

    // [75-100] Extreme overbought
    if (rsi !== null && rsi >= 75
     && zscore_h1 > 2.5
     && zscore_h1_max3 !== null && zscore_h1 < zscore_h1_max3)
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
    };

    if (riskCfg.reversalEnabled === false) return [];

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
        num(row?.zscore_h1_max3),
        num(row?.rsi_m5)
      );
      if (!match) continue;

      // SELL reversal activé partout (volume indices non significatif)

      const score = 80;

      opps.push({
        type:       match.type,
        regime:     `${match.type}_${match.side}`,
        route:      match.route,
        engine:     "REVERSAL_LAB",
        index:      i,
        timestamp:  row?.timestamp,
        symbol,
        side:       match.side,
        signalType: match.side,
        score,

        // H4 (passthrough)
        slope_h4:   num(row?.slope_h4),
        dslope_h4:  num(row?.dslope_h4),
        drsi_h4:    num(row?.drsi_h4),

        // H1
        rsi_h1:     num(row?.rsi_h1),
        slope_h1:   num(row?.slope_h1),
        dslope_h1:  num(row?.dslope_h1),
        drsi_h1:    num(row?.drsi_h1),
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

        close:      num(row?.close),
        spread_price: num(row?.spread_price),
        intraday_change: num(row?.intraday_change),
      });
    }

    opps.sort((a, b) => {
      const sa = a.score ?? 0, sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""));
    });

    opps = applyDedupeAndSpacing(opps, TOP_CFG);

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_REVERSAL_LAB;
