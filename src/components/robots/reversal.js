// ============================================================================
// reversal.js — H1 REVERSAL STRATEGY
// - Compatible TopOpportunities RSI Router (index numeric + regime added)
// - Logging gated by opts.debug
// - ✅ slopeMin / slopeMax calibrés par asset via SlopeConfig (P40/P60/P95)
// ============================================================================

import { getSignalConfig } from "../config/SignalConfig.js";
import { getSlopeConfig }  from "../config/SlopeConfig";


const ReversalStrategy = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // CONFIG VALIDATION
  // ============================================================================
  function isValidCfg(cfg) {
    if (!cfg) return false;

    const required = [
      "rsiWindowH1",
      "rsiBuyMax",
      "rsiSellMin",
      "flipSlopeMin",
      "flipDslopeMin",
      "dbbzBuyMin",
      "dbbzSellMax"
    ];

    return required.every(k => Number.isFinite(Number(cfg[k])));
  }

  // ============================================================================
  // RSI WINDOW H1
  // Priorité : champs pré-calculés CSV (rsi_h1_previouslow3 / previoushigh3)
  // Fallback : boucle sur N bougies H1 distinctes
  // ============================================================================
  function getMinMaxRSI_H1(rows, i, bars = 3) {
    const row     = rows[i];
    const current = num(row?.rsi_h1);
    if (current === null) return null;

    // ── Champs pré-calculés (Matrix) ──
    const prevLow  = num(row?.rsi_h1_previouslow3);
    const prevHigh = num(row?.rsi_h1_previoushigh3);

    if (prevLow !== null && prevHigh !== null) {
      return { minRSI: prevLow, maxRSI: prevHigh, currentRSI: current };
    }

    // ── Fallback : boucle historique ──
    let count    = 0;
    let min      = Infinity;
    let max      = -Infinity;
    let lastHour = null;

    for (let k = i; k >= 0; k--) {
      const ts   = rows[k]?.timestamp;
      const hour = ts?.slice(0, 13);
      if (!hour) continue;
      if (hour === lastHour) continue;

      lastHour = hour;

      const rsi = num(rows[k]?.rsi_h1);
      if (rsi === null) return null;

      if (rsi < min) min = rsi;
      if (rsi > max) max = rsi;

      count++;
      if (count >= bars) break;
    }

    if (count < bars) return null;

    return { minRSI: min, maxRSI: max, currentRSI: current };
  }

  // ============================================================================
  // H1 DYNAMICS
  // ============================================================================
  function getH1Dynamics(row) {
    const slope  = num(row?.slope_h1);
    const dslope = num(row?.dslope_h1);
    const dbbz   = num(row?.dz_h1);
    const zscore = num(row?.zscore_h1);

    if (slope === null || dslope === null || dbbz === null) return null;

    return { slope, dslope, dbbz, zscore };
  }

  // ============================================================================
  // SLOPE LIMITS — calibrés par asset via SlopeConfig
  //
  // slopeMin  = frontière flat/weak  (P40 côté sell, P60 côté buy)
  //           → minimum requis pour valider le retournement
  // slopeMax  = frontière strong/extreme (P95)
  //           → spike filter, au-delà le mouvement est trop violent
  // ============================================================================
  // Reversal = direction OPPOSÉE à la continuation
  // BUY reversal : prix baisse → slope négatif → seuils down_*
  // SELL reversal : prix monte → slope positif → seuils up_*
  function getSlopeLimits(side, symbol) {
    const slopeCfg = getSlopeConfig(symbol);

    if (side === "BUY") {
      return {
        slopeMin: Math.abs(slopeCfg.down_weak.max),
        slopeMax: Math.abs(slopeCfg.down_extreme.max),
      };
    } else {
      return {
        slopeMin: slopeCfg.up_weak.min,
        slopeMax: slopeCfg.up_extreme.min,
      };
    }
  }

  // ============================================================================
  // STRUCTURE GATE
  // - slopeMin : frontière flat/weak per asset (remplace cfg.slopeH1Min fixe)
  // - slopeMax : spike filter per asset        (remplace cfg.dslopeH1MaxAbs fixe)
  // ============================================================================
  function passesStructureGate(side, rsiStats, dyn, cfg, symbol) {
    const rsi    = num(rsiStats?.currentRSI);
    const slope  = num(dyn?.slope);
    const dslope = num(dyn?.dslope);

    if (rsi === null || slope === null || dslope === null) return false;

    const { slopeMin, slopeMax } = getSlopeLimits(side, symbol);
    const dslopeMin = cfg.dslopeH1ReversalMin ?? 0.5;

    const zscore = num(dyn?.zscore);

    // BUY REVERSAL
    if (side === "BUY") {
      // Spike bypass EXTREME — RSI < 20, slope extrême mais décélération
      if (rsi < 20 && slope < -slopeMax && dslope > dslopeMin && zscore !== null && zscore < -1.6)
        return true;

      // Spike bypass DEEP — RSI < 30
      if (rsi < 30 && slope < -slopeMax && dslope > 1 && zscore !== null && zscore < -2)
        return true;

      // Spike filter — slope trop violent
      if (Math.abs(slope) > slopeMax) return false;

      // Zone EXTREME (RSI 0–20) — survente extrême, slope cap configurable
      if (rsi < 20) return slope > -(cfg.slopeExtremeBuyMax ?? 4) && dslope > dslopeMin;
      // Zone DEEP (RSI 20–30) — slope doit avoir une amplitude minimale
      if (rsi < 30) return dslope > dslopeMin && Math.abs(slope) >= slopeMin;
      // Zone SEMI (RSI 30–35) — transition basse
      if (rsi < 35) return slope >= slopeMin && dslope > dslopeMin;
      return false;
    }

    // SELL REVERSAL
    if (side === "SELL") {
      // Spike bypass EXTREME — RSI > 80, slope extrême mais décélération
      if (rsi > 80 && slope > slopeMax && dslope < -dslopeMin && zscore !== null && zscore > 1.6)
        return true;

      // Spike bypass DEEP — RSI > 70
      if (rsi > 70 && slope > slopeMax && dslope < -1 && zscore !== null && zscore > 2)
        return true;

      // Spike filter — slope trop violent
      if (Math.abs(slope) > slopeMax) return false;

      // Zone EXTREME (RSI 80–100) — surachat extrême, slope cap configurable
      if (rsi > 80) return slope < (cfg.slopeExtremeSellMax ?? 4) && dslope < -dslopeMin;
      // Zone DEEP (RSI 70–80) — slope doit avoir une amplitude minimale
      if (rsi > 70) return dslope < -dslopeMin && Math.abs(slope) >= slopeMin;
      // Zone SEMI (RSI 65–70) — transition haute
      if (rsi > 65) return slope <= -slopeMin && dslope < -dslopeMin;
      return false;
    }

    return false;
  }

  // ============================================================================
  // EARLY DETECTION
  // ============================================================================
  function isEarlyBuyConfirmed(dyn, cfg) {
    const slope1 = dyn.slope - dyn.dslope;
    return (
      slope1 < 0 &&
      dyn.slope > 0 &&
      Math.abs(dyn.slope)  >= cfg.flipSlopeMin &&
      Math.abs(dyn.dslope) >= cfg.flipDslopeMin
    );
  }

  function isEarlySellConfirmed(dyn, cfg) {
    const slope1 = dyn.slope - dyn.dslope;
    return (
      slope1 > 0 &&
      dyn.slope < 0 &&
      Math.abs(dyn.slope)  >= cfg.flipSlopeMin &&
      Math.abs(dyn.dslope) >= cfg.flipDslopeMin
    );
  }

  // ============================================================================
  // RSI PATH
  // ============================================================================
  function detectBuy(rsiStats, dyn, cfg) {
    if (rsiStats.minRSI > cfg.rsiBuyMax) return null;

    // Position extrême requise
const z = num(dyn?.zscore);
if (z === null || z > -1.6) return null;

// =========================================================
// ✅ MATURITY BLOCK — encore en accélération baissière
// =========================================================

if (
  dyn.zscore !== null &&
  dyn.dbbz !== null &&
  dyn.dslope !== null &&
  dyn.zscore < -1.8 &&
  dyn.dbbz < -1.0 &&
  dyn.dslope < -3.0
)
  return null;

    return isEarlyBuyConfirmed(dyn, cfg) ? "BUY_EARLY" : "BUY";
  }

  function detectSell(rsiStats, dyn, cfg) {
    if (rsiStats.maxRSI < cfg.rsiSellMin) return null;

// Position extrême requise
const z = num(dyn?.zscore);
if (z === null || z < 1.6) return null;

// =========================================================
// ✅ MATURITY BLOCK — encore en accélération haussière
// =========================================================

if (
  dyn.zscore !== null &&
  dyn.dbbz !== null &&
  dyn.dslope !== null &&
  dyn.zscore > 1.8 &&
  dyn.dbbz > 1.0 &&
  dyn.dslope > 3.0
)
  return null;

    return isEarlySellConfirmed(dyn, cfg) ? "SELL_EARLY" : "SELL";
  }

  // ============================================================================
  // ZMID PATH — Regime 3 : reversal autour de la bande milieu Bollinger
  // ============================================================================
  function detectZmid(row, dyn) {
    const zscore = num(dyn?.zscore);
    const slope  = num(dyn?.slope);
    const dslope = num(dyn?.dslope);
    const rsi    = num(row?.rsi_h1);
    const zMin3  = num(row?.zscore_h1_min3);
    const zMax3  = num(row?.zscore_h1_max3);

    if (zscore === null || slope === null || dslope === null ||
        rsi === null || zMin3 === null || zMax3 === null) return null;

    const amplitude = zMax3 - zMin3;

    // SELL_ZMID — venait d'en bas, cloche, momentum s'effondre
    if (Math.abs(zscore) < 0.5 && zMin3 < -1.0 && amplitude > 0.5 &&
        dslope < -1.0 && slope < 3.0 && rsi < 55)
      return "SELL_ZMID";

    // BUY_ZMID — venait d'en haut, cloche inversée, momentum repart
    if (Math.abs(zscore) < 0.5 && zMax3 > 1.0 && amplitude > 0.5 &&
        dslope > 1.0 && slope > -2.0 && rsi > 45)
      return "BUY_ZMID";

    return null;
  }

  // ============================================================================
  // SCORE
  // ============================================================================
  function computeScore(rsiStats, dyn, signalType, cfg) {
    let score = 0;

    if (signalType.includes("BUY"))
      score += Math.round((cfg.rsiBuyMax - rsiStats.minRSI) * 2);
    else
      score += Math.round((rsiStats.maxRSI - cfg.rsiSellMin) * 2);

    score += Math.round(Math.abs(dyn.dslope) * 100);
    score += Math.round(Math.abs(dyn.dbbz) * 50);

    if (signalType.includes("EARLY"))
      score += cfg.earlyScoreBonus ?? 20;

    return Math.max(score, 0);
  }

  // ============================================================================
  // MAIN EVALUATE
  // ============================================================================
  function evaluate(rows = [], opts = {}) {
    const data = Array.isArray(rows) ? rows : [];
    if (!data.length) return [];

    const symbol = data[0]?.symbol;
    if (!symbol) return [];

    const cfg = getSignalConfig(symbol)?.h1Reversal;
    if (!isValidCfg(cfg)) return [];

    const scoreMin = num(opts.scoreMin) ?? 0;
    const debug    = Boolean(opts.debug);

    const opps = [];

    const d = {
      total:             0,
      structureFiltered: 0,
      scoreFiltered:     0,
      signals:           0
    };

    for (let i = 0; i < data.length; i++) {
      d.total++;

      const dyn = getH1Dynamics(data[i]);

      // ── Regime 3 : ZMID (indépendant de rsiStats / structure gate) ──
      if (dyn) {
        const zmidSignal = detectZmid(data[i], dyn);
        if (zmidSignal) {
          const zmidSide = zmidSignal.startsWith("BUY") ? "BUY" : "SELL";
          const zmidScore = Math.round(Math.abs(dyn.dslope) * 100 + Math.abs(dyn.dbbz) * 50);

          if (zmidScore >= scoreMin) {
            d.signals++;
            opps.push({
              type:       "REVERSAL",
              regime:     zmidSide === "BUY" ? "REVERSAL_BUY" : "REVERSAL_SELL",
              index:      i,
              timestamp:  data[i]?.timestamp,
              symbol,
              side:       zmidSide,
              signalType: zmidSignal,
              score:      zmidScore,

              rsi_h1:    num(data[i]?.rsi_h1),
              slope_h1:  dyn.slope,
              dslope_h1: dyn.dslope,
              dz_h1:     dyn.dbbz,
              atr_h1:    num(data[i]?.atr_h1),
              zscore_h1: num(data[i]?.zscore_h1),
              zscore_m5: num(data[i]?.zscore_m5),
              rsi_m5:    num(data[i]?.rsi_m5),
              slope_m5:  num(data[i]?.slope_m5),
              dslope_m5: num(data[i]?.dslope_m5),
              drsi_m5:   num(data[i]?.drsi_m5),
            });
          }
          continue;
        }
      }

      // ── Regime 1 & 2 : RSI extreme + phase ──
      const rsiStats = getMinMaxRSI_H1(data, i, cfg.rsiWindowH1);
      if (!rsiStats) continue;

      if (!dyn) continue;

      // ── Regime 1 & 2 ──
      const signalType =
        detectBuy(rsiStats, dyn, cfg)   ??
        detectSell(rsiStats, dyn, cfg);

      if (!signalType) continue;

      const side = signalType.startsWith("BUY") ? "BUY" : "SELL";

      // ✅ symbol passé pour calibration per-asset
      if (!passesStructureGate(side, rsiStats, dyn, cfg, symbol)) {
        d.structureFiltered++;
        continue;
      }

      const score = computeScore(rsiStats, dyn, signalType, cfg);

      if (score < scoreMin) {
        d.scoreFiltered++;
        continue;
      }

      d.signals++;

      const regime = side === "BUY" ? "REVERSAL_BUY" : "REVERSAL_SELL";

      opps.push({
        type:       "REVERSAL",
        regime,
        index:      i,
        timestamp:  data[i]?.timestamp,
        symbol,
        side,
        signalType,
        score,

        rsi_h1:    rsiStats.currentRSI,
        slope_h1:  dyn.slope,
        dslope_h1: dyn.dslope,
        dz_h1:     dyn.dbbz,
        atr_h1:    num(data[i]?.atr_h1),
        zscore_h1: num(data[i]?.zscore_h1),
        zscore_m5: num(data[i]?.zscore_m5),
        rsi_m5:    num(data[i]?.rsi_m5),
        slope_m5:  num(data[i]?.slope_m5),
        dslope_m5: num(data[i]?.dslope_m5),
        drsi_m5:   num(data[i]?.drsi_m5),
      });
    }

    if (debug) console.info("REVERSAL REPORT", d);

    // ================================================================
    // AUDIT MODE — test all detectors independently on every row
    // ================================================================
    if (opts.audit) {
      const audit = {
        total_rows: data.length,
        conflicts: [],
        shadowed:  [],
        coverage:  {},
      };

      for (let i = 0; i < data.length; i++) {
        const rsiStats = getMinMaxRSI_H1(data, i, cfg.rsiWindowH1);
        const dyn = getH1Dynamics(data[i]);
        if (!dyn) continue;

        // Test each detector independently
        const results = {};
        if (rsiStats) {
          const b = detectBuy(rsiStats, dyn, cfg);
          if (b) results.detectBuy = b;
          const s = detectSell(rsiStats, dyn, cfg);
          if (s) results.detectSell = s;
        }
        const zm = detectZmid(data[i], dyn);
        if (zm) {
          if (zm.startsWith("BUY"))  results.detectBuyZmid = zm;
          if (zm.startsWith("SELL")) results.detectSellZmid = zm;
        }

        const fired = Object.keys(results);
        if (fired.length === 0) continue;

        // Coverage
        for (const det of fired) {
          const sig = results[det];
          audit.coverage[sig] = (audit.coverage[sig] || 0) + 1;
        }

        // Conflicts: 2+ detectors fire on same row
        if (fired.length > 1) {
          audit.conflicts.push({
            index: i,
            timestamp: data[i]?.timestamp,
            detectors: fired.map(k => results[k]),
          });
        }

        // Shadowed: what the ?? chain would pick vs what else fired
        const chainResult = results.detectBuy
          ?? results.detectSell;
        // ZMID fires first in evaluate (before chain)
        const actualWinner = zm ?? chainResult;

        if (fired.length > 1 && actualWinner) {
          for (const det of fired) {
            const sig = results[det];
            if (sig !== actualWinner) {
              audit.shadowed.push({
                index: i,
                timestamp: data[i]?.timestamp,
                fired: sig,
                shadowed_by: actualWinner,
              });
            }
          }
        }
      }

      console.info("REVERSAL AUDIT", {
        total_rows: audit.total_rows,
        conflicts_count: audit.conflicts.length,
        shadowed_count: audit.shadowed.length,
        coverage: audit.coverage,
      });

      if (audit.conflicts.length > 0) {
        console.info("AUDIT CONFLICTS (first 20):", audit.conflicts.slice(0, 20));
      }
      if (audit.shadowed.length > 0) {
        console.info("AUDIT SHADOWED (first 20):", audit.shadowed.slice(0, 20));
      }

      opps.audit = audit;
    }

    return opps;
  }

  return { evaluate };

})();

export default ReversalStrategy;