// ============================================================================
// TopOpportunities_CONTINUATION_LAB.js — CONTINUATION-ONLY LAB ENGINE
// Refonte from scratch basée sur les données corrigées (mars 2026)
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";

const TopOpportunities_CONTINUATION_LAB = (() => {

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
  // CONTINUATION ROUTE MATCHER
  // =========================
  function matchRoute(rsi, slope_h1, dslope_h1, drsi_h1, zscore_h1, prevLow3, prevHigh3, zscore_h1_min3, zscore_h1_max3, drsi_h4, slope_h4, intraday_change) {
    if (rsi === null || slope_h1 === null || zscore_h1 === null)
      return null;

    // ── BUY CONTINUATION — slope progressif par zone ──────────────
    // [35-50]
    if (rsi >= 35 && rsi < 50
     && slope_h1 > 0.3 && slope_h1 < 6
     && zscore_h1 < 1.2
     && dslope_h1 !== null && dslope_h1 > 0.1
)
      return { route: "BUY-C-[35-50]", side: "BUY", type: "CONTINUATION" };

    // [50-65]
    if (rsi >= 50 && rsi < 65
     && slope_h1 > 0.3 && slope_h1 < 6
     && zscore_h1 < 1.2
     && dslope_h1 !== null && dslope_h1 > 0.1
)
      return { route: "BUY-C-[50-65]", side: "BUY", type: "CONTINUATION" };

    // [65-70]
    if (rsi >= 65 && rsi < 70
     && slope_h1 > 0.3 && slope_h1 < 6
     && zscore_h1 < 1.2
     && dslope_h1 !== null && dslope_h1 > 0.1
)
      return { route: "BUY-C-[65-70]", side: "BUY", type: "CONTINUATION" };

    // ── SELL CONTINUATION ───────────────────────────────────────────
    // [65-50]
    if (rsi >= 50 && rsi < 65
     && slope_h1 < -0.3 && slope_h1 > -6
     && zscore_h1 > -1.2
     && dslope_h1 !== null && dslope_h1 < -0.1
)
      return { route: "SELL-C-[65-50]", side: "SELL", type: "CONTINUATION" };

    // [50-35]
    if (rsi >= 35 && rsi < 50
     && slope_h1 < -0.3 && slope_h1 > -6
     && zscore_h1 > -1.2
     && dslope_h1 !== null && dslope_h1 < -0.1
)
      return { route: "SELL-C-[50-35]", side: "SELL", type: "CONTINUATION" };

    // [35-30]
    if (rsi >= 30 && rsi < 35
     && slope_h1 < -0.3 && slope_h1 > -6
     && zscore_h1 > -1.2
     && dslope_h1 !== null && dslope_h1 < -0.1
)
      return { route: "SELL-C-[35-30]", side: "SELL", type: "CONTINUATION" };

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

    let opps = [];
    const atrH1Cap = num(riskCfg?.atrH1Cap);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

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
        num(row?.drsi_h4),
        num(row?.slope_h4),
        num(row?.intraday_change)
      );
      if (!match) continue;

      const score = Math.max(0, Math.round(
        Math.abs(num(row?.slope_h1) ?? 0) * 50 +
        Math.abs((num(row?.rsi_h1) ?? 50) - 50) * 2
      ));

      opps.push({
        type:       match.type,
        regime:     `${match.type}_${match.side}`,
        route:      match.route,
        engine:     "CONTINUATION_LAB",
        index:      i,
        timestamp:  row?.timestamp,
        symbol,
        side:       match.side,
        signalType: match.side,
        score,

        slope_h4:   num(row?.slope_h4),
        dslope_h4:  num(row?.dslope_h4),
        drsi_h4:    num(row?.drsi_h4),

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

        atr_m15:    num(row?.atr_m15),
        rsi_m15:    num(row?.rsi_m15),
        slope_m15:  num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

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

export default TopOpportunities_CONTINUATION_LAB;
