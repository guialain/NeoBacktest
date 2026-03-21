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
  function getRsiRegime(rsi, cfg) {
    const r = num(rsi);
    if (r === null) return null;

    if (r <= 30) return "REVERSAL_BUY";
    if (r <= 35) return "TRANSITION_LOW";
    if (r >= 70) return "REVERSAL_SELL";
    if (r >= 65) return "TRANSITION_HIGH";
    return "CONTINUATION";
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
      rsiReversalBuyMax:  num(opts?.rsiReversalBuyMax)  ?? 35,
      rsiReversalSellMin: num(opts?.rsiReversalSellMin) ?? 65,

      minSignalSpacingMinutes: num(opts?.minSignalSpacingMinutes) ?? 0,
      maxSignals:              num(opts?.maxSignals) ?? Infinity,

      scoreMin: num(opts?.scoreMin) ?? 0,
      debug: Boolean(opts?.debug),
    };

    // Route indices by RSI regime
    const idxReversalBuy    = [];
    const idxReversalSell   = [];
    const idxContinuation   = [];
    const idxTransitionLow  = [];
    const idxTransitionHigh = [];

    for (let i = 0; i < rows.length; i++) {
      const rsi = num(rows[i]?.rsi_h1);
      const regime = getRsiRegime(rsi, TOP_CFG);
      if (!regime) continue;

      if (regime === "REVERSAL_BUY")    idxReversalBuy.push(i);
      else if (regime === "REVERSAL_SELL")   idxReversalSell.push(i);
      else if (regime === "TRANSITION_LOW")  idxTransitionLow.push(i);
      else if (regime === "TRANSITION_HIGH") idxTransitionHigh.push(i);
      else if (regime === "CONTINUATION")    idxContinuation.push(i);
    }

    const keepByIndexSet = (opps, idxArr) => {
      const set = new Set(idxArr);
      return (Array.isArray(opps) ? opps : []).filter(o => set.has(num(o?.index)));
    };

    // Run strategies on full dataset
    const baseOpts = { ...opts, scoreMin: 0 };

    const reversalOppsAll = ReversalStrategy.evaluate(rows, baseOpts).map(normalizeOpp);
    const contOppsAll     = ContinuationStrategy.evaluate(rows, baseOpts).map(normalizeOpp);

    // ZMID bypasses RSI router
    for (const opp of reversalOppsAll) {
      if (!opp?.signalType?.includes("ZMID")) continue;
      const idx = num(opp.index);
      if (idx === null) continue;
      if (opp.side === "BUY")  idxReversalBuy.push(idx);
      if (opp.side === "SELL") idxReversalSell.push(idx);
    }

    // Route — TRANSITION zones get both reversal + continuation
    const reversalBuy  = keepByIndexSet(reversalOppsAll, idxReversalBuy).filter(o => o?.side === "BUY");
    const reversalSell = keepByIndexSet(reversalOppsAll, idxReversalSell).filter(o => o?.side === "SELL");
    const continuation = keepByIndexSet(contOppsAll, idxContinuation);

    // Transition zones: reversal semi + continuation both directions
    const transLowRev  = keepByIndexSet(reversalOppsAll, idxTransitionLow);
    const transLowCont = keepByIndexSet(contOppsAll, idxTransitionLow);
    const transHighRev = keepByIndexSet(reversalOppsAll, idxTransitionHigh);
    const transHighCont = keepByIndexSet(contOppsAll, idxTransitionHigh);

    // Merge all
    let opps = [
      ...reversalBuy,
      ...transLowRev, ...transLowCont,
      ...continuation,
      ...transHighCont, ...transHighRev,
      ...reversalSell,
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
      console.info("🧠 TOPOPP RSI ROUTER REPORT", {
        symbol,
        total_bars: rows.length,
        rsiReversalBuyMax: TOP_CFG.rsiReversalBuyMax,
        rsiReversalSellMin: TOP_CFG.rsiReversalSellMin,
        zone_counts: {
          REVERSAL_BUY: idxReversalBuy.length,
          CONTINUATION: idxContinuation.length,
          REVERSAL_SELL: idxReversalSell.length,
        },
        generated: {
          reversal_all: Array.isArray(reversalOppsAll) ? reversalOppsAll.length : 0,
          continuation_all: Array.isArray(contOppsAll) ? contOppsAll.length : 0,
        },
        kept_after_routing: {
          reversal_buy: reversalBuy.length,
          continuation: continuation.length,
          reversal_sell: reversalSell.length,
        },
        final_candidates: opps.length,
        spacing_min: TOP_CFG.minSignalSpacingMinutes,
        scoreMin: TOP_CFG.scoreMin,
        maxSignals: TOP_CFG.maxSignals,
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities;