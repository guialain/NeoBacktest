// ============================================================================
// TopOpportunities.js — NEO MATRIX (vNext RSI-ROUTED ORCHESTRATOR) — REVISED
// Rôle: générer les candidats "opportunities" (BRUTS) à partir du marché,
// puis laisser SignalFilters.js faire VALID / WAIT.
//
// RSI-first routing (per bar, based on rsi_h1):
// - RSI ∈ [0..33]   => REVERSAL BUY only
// - RSI ∈ (33..67)  => CONTINUATION BUY/SELL
// - RSI ∈ [67..100] => REVERSAL SELL only
//
// Notes:
// - Conserve un format unique d'opportunity pour SignalFilters/tradeSimulator.
// - Dédoublonnage / spacing optionnels (recommandé pour éviter spam).
// ============================================================================

import ReversalStrategy from "./reversal";
import ContinuationStrategy from "./continuation";

const TopOpportunities = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================
  // RSI REGIME ROUTER
  // =========================
  function getRsiRegime(rsi) {
    const r = num(rsi);
    if (r === null) return null;

    if (r < 20) return "EXTREME_OVERSOLD";
    if (r < 30) return "OVERSOLD";
    if (r < 35) return "TRANSITION_LOW_1";
    if (r < 45) return "TRANSITION_LOW_2";
    if (r < 55) return "NEUTRAL";
    if (r < 65) return "TRANSITION_HIGH_2";
    if (r < 70) return "TRANSITION_HIGH_1";
    if (r < 80) return "OVERBOUGHT";
    return "EXTREME_OVERBOUGHT";
  }

  // =========================
  // SAFE NORMALIZATION (tolerant)
  // =========================
 function normalizeOpp(opp) {
  const rawType = String(opp?.type ?? "");
  const rawSide = String(opp?.side ?? "");

  const t = rawType.trim().toUpperCase();
  const s = rawSide.trim().toUpperCase();

  const normType =
    t === "REVERSAL" || t === "CONTINUATION"
      ? t
      : rawType.trim().toLowerCase() === "reversal"
        ? "REVERSAL"
        : rawType.trim().toLowerCase() === "continuation"
          ? "CONTINUATION"
          : (t || rawType);

  return {
    ...opp,
    type: normType,
    side: s || opp?.side,
    regime: opp?.regime
  };
}

  // =========================
  // SPACING / DEDUPE (optional)
  // =========================
  function minutesBetween(tsA, tsB) {
    // timestamps expected like "2026.02.18 10:25"
    if (!tsA || !tsB) return null;

    const toDate = (ts) => {
      const [d, t] = String(ts).split(" ");
      if (!d || !t) return null;
      const iso = `${d.replace(/\./g, "-")}T${t}:00`;
      const dt = new Date(iso);
      return isNaN(dt.getTime()) ? null : dt;
    };

    const a = toDate(tsA);
    const b = toDate(tsB);
    if (!a || !b) return null;

    return Math.abs((a.getTime() - b.getTime()) / 60000);
  }

  function makeKey(opp) {
    return [
      opp?.symbol ?? "",
      opp?.type ?? "",
      opp?.side ?? "",
      opp?.signalPhase ?? "",
      opp?.regime ?? ""
    ].join("|");
  }

  function applyDedupeAndSpacing(opps, cfg) {
    const out = [];
    const seen = new Map(); // key -> lastTimestamp kept

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
  // MAIN
  // =========================
  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const symbol = rows[0]?.symbol;
    if (!symbol) return [];

    const TOP_CFG = {
      minSignalSpacingMinutes: num(opts?.minSignalSpacingMinutes) ?? 0,
      maxSignals:              num(opts?.maxSignals) ?? Infinity,
      scoreMin: num(opts?.scoreMin) ?? 0,
      debug: Boolean(opts?.debug),
    };

    // Route indices by RSI regime (9 zones)
    const idxReversal    = [];  // EXTREME_OVERSOLD, OVERSOLD, EXTREME_OVERBOUGHT, OVERBOUGHT
    const idxTransition1 = [];  // TRANSITION_LOW_1, TRANSITION_HIGH_1 (reversal + cont)
    const idxTransition2 = [];  // TRANSITION_LOW_2, TRANSITION_HIGH_2 (cont only)
    // NEUTRAL → no indices (WAIT)

    for (let i = 0; i < rows.length; i++) {
      const rsi = num(rows[i]?.rsi_h1);
      const regime = getRsiRegime(rsi);
      if (!regime) continue;

      switch (regime) {
        case "EXTREME_OVERSOLD":
        case "OVERSOLD":
        case "OVERBOUGHT":
        case "EXTREME_OVERBOUGHT":
          idxReversal.push(i);
          break;
        case "TRANSITION_LOW_1":
        case "TRANSITION_HIGH_1":
          idxTransition1.push(i);
          break;
        case "TRANSITION_LOW_2":
        case "TRANSITION_HIGH_2":
          idxTransition2.push(i);
          break;
        // NEUTRAL → skip
      }
    }

    const keepByIndexSet = (opps, idxArr) => {
      const set = new Set(idxArr);
      return (Array.isArray(opps) ? opps : []).filter(o => set.has(num(o?.index)));
    };

    // Run strategies on full dataset
    const baseOpts = { ...opts, scoreMin: 0 };

    const reversalOppsAll = ReversalStrategy.evaluate(rows, baseOpts).map(normalizeOpp);
    const contOppsAll     = ContinuationStrategy.evaluate(rows, baseOpts).map(normalizeOpp);

    // ZMID bypasses RSI router — add to reversal indices
    for (const opp of reversalOppsAll) {
      if (!opp?.signalType?.includes("ZMID")) continue;
      const idx = num(opp.index);
      if (idx !== null) idxReversal.push(idx);
    }

    // Dispatch per zone
    const reversal     = keepByIndexSet(reversalOppsAll, idxReversal);
    const trans1Rev    = keepByIndexSet(reversalOppsAll, idxTransition1);
    const trans1Cont   = keepByIndexSet(contOppsAll, idxTransition1);
    const trans2Cont   = keepByIndexSet(contOppsAll, idxTransition2);

    // Merge — NEUTRAL produces nothing
    let opps = [
      ...reversal,
      ...trans1Rev, ...trans1Cont,
      ...trans2Cont,
    ];

    // Top-level scoreMin
    if (Number.isFinite(TOP_CFG.scoreMin) && TOP_CFG.scoreMin > 0) {
      opps = opps.filter(o => num(o?.score ?? o?.raw_score) >= TOP_CFG.scoreMin);
    }

    // Sort: score desc, then latest timestamp
    opps.sort((a, b) => {
      const sa = num(a?.score ?? a?.raw_score) ?? 0;
      const sb = num(b?.score ?? b?.raw_score) ?? 0;
      if (sb !== sa) return sb - sa;

      const ta = a?.timestamp ?? "";
      const tb = b?.timestamp ?? "";
      return String(tb).localeCompare(String(ta));
    });

    // Dedupe/spacing
    opps = applyDedupeAndSpacing(opps, TOP_CFG);

    if (TOP_CFG.debug) {
      console.info("TOPOPP 9-ZONE ROUTER", {
        symbol,
        total_bars: rows.length,
        zone_counts: {
          reversal: idxReversal.length,
          transition1: idxTransition1.length,
          transition2: idxTransition2.length,
        },
        generated: {
          reversal_all: reversalOppsAll.length,
          continuation_all: contOppsAll.length,
        },
        kept: {
          reversal: reversal.length,
          trans1_rev: trans1Rev.length,
          trans1_cont: trans1Cont.length,
          trans2_cont: trans2Cont.length,
        },
        final: opps.length,
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities;