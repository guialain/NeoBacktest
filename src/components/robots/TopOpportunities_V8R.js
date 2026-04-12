// ============================================================================
// TopOpportunities_V8R.js — H1 ROUTER V8R
//
// RESOLVE = IC (intradayChange) + slopeH4 + dslopeH4 → TYPE
//
//   IC              slopeH4   dslopeH4      => TYPE
//   ─────────────────────────────────────────────────────
//   SOFT/STRONG_UP  UP        NEUTRE/UP+    => CONT  BUY
//   EXPLOSIVE_UP    UP        NEUTRE/UP+    => CONT  BUY  (conditions si NEUTRE)
//   SOFT_UP         DOWN      UP+           => REV   BUY  (strict)
//   STRONG/EXP_UP   DOWN      UP+           => REV   BUY  (conditions)
//   SPIKE_UP        DOWN      NEUTRE/UP+    => REV   BUY  spike
//   (miroir pour SELL : IC DOWN, signe dslopeH4 inversé)
//   NEUTRE / H4 NEUTRE / SPIKE sens H4 / dslopeH4 contre-tendance => WAIT
//
// H1 → timing seulement (route RSI Gate 2)
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";
import { INTRADAY_CONFIG } from "../config/IntradayConfig.js";
import { getSlopeConfig } from "../config/SlopeConfig.js";
import { getDrsiConfig } from "../config/DrsiConfig.js";

const TopOpportunities_V8R = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // NIVEAU 1 — REGIME FUNCTIONS
  // ============================================================================
  function getIntradayLevel(intra, cfg) {
    if (intra === null) return "NEUTRE";
    if (intra >  cfg.spikeUp)       return "SPIKE_UP";
    if (intra >= cfg.explosiveUp)   return "EXPLOSIVE_UP";
    if (intra >= cfg.strongUp)      return "STRONG_UP";
    if (intra >= cfg.softUp)        return "SOFT_UP";
    if (intra >  cfg.softDown)      return "NEUTRE";
    if (intra >  cfg.strongDown)    return "SOFT_DOWN";
    if (intra >  cfg.explosiveDown) return "STRONG_DOWN";
    if (intra >  cfg.spikeDown)     return "EXPLOSIVE_DOWN";
    return "SPIKE_DOWN";
  }

  function getSlopeRegime(slope, cfg) {
    if (slope === null || !cfg) return "NEUTRE";
    if (slope >  cfg.spikeUp)       return "SPIKE_UP";
    if (slope >= cfg.explosiveUp)   return "EXPLOSIVE_UP";
    if (slope >= cfg.strongUp)      return "STRONG_UP";
    if (slope >= cfg.softUp)        return "SOFT_UP";
    if (slope >  cfg.softDown)      return "NEUTRE";
    if (slope >  cfg.strongDown)    return "SOFT_DOWN";
    if (slope >  cfg.explosiveDown) return "STRONG_DOWN";
    if (slope >  cfg.spikeDown)     return "EXPLOSIVE_DOWN";
    return "SPIKE_DOWN";
  }

  // ============================================================================
  // 3D RESOLUTION : intradayLevel x slopeH4Level x dslopeH4 => { type, mode }
  // H1 → timing seulement (route RSI Gate 2)
  // ============================================================================
  const DOWN_HALF = ["SPIKE_DOWN","EXPLOSIVE_DOWN","STRONG_DOWN","SOFT_DOWN"];
  const UP_HALF   = ["SOFT_UP","STRONG_UP","EXPLOSIVE_UP","SPIKE_UP"];
  const XTRM_DOWN = ["SPIKE_DOWN","EXPLOSIVE_DOWN"];
  const XTRM_UP   = ["EXPLOSIVE_UP","SPIKE_UP"];

  // thr = seuil de significativité dslopeH4 (défaut 1, configurable par asset via slopeCfg.dslopeH4Thr)
  //
  // Trois états dslopeH4 :
  //   UP+   = dslopeH4 >= +thr  (H4 accélère haussier)
  //   DOWN- = dslopeH4 <= -thr  (H4 accélère baissier)
  //   NEUTRE = entre les deux   (décelération ou neutre)
  //
  // Logique :
  //   CONT  BUY  : IC UP   + H4 UP   + dslopeH4 ∈ {NEUTRE, UP+}
  //   CONT  SELL : IC DOWN + H4 DOWN + dslopeH4 ∈ {NEUTRE, DOWN-}
  //   REV   BUY  : IC UP   + H4 DOWN + dslopeH4 = UP+  (H4 qui se retourne)
  //   REV   SELL : IC DOWN + H4 UP   + dslopeH4 = DOWN-
  //   SPIKE BUY  : IC SPIKE_UP   + H4 DOWN + dslopeH4 ∈ {NEUTRE, UP+}
  //   SPIKE SELL : IC SPIKE_DOWN + H4 UP   + dslopeH4 ∈ {NEUTRE, DOWN-}
  //   WAIT  : IC NEUTRE, H4 NEUTRE, SPIKE dans sens H4, dslopeH4 contre-tendance
  function resolve3D(intradayLevel, slopeH4Level, dslopeH4, side, thr = 1) {
    const h4Up   = UP_HALF.includes(slopeH4Level);
    const h4Down = DOWN_HALF.includes(slopeH4Level);

    // Trois états dslopeH4
    const dh4Pos = dslopeH4 !== null && dslopeH4 >= thr;   // UP+
    const dh4Neg = dslopeH4 !== null && dslopeH4 <= -thr;  // DOWN-
    const dh4Neu = !dh4Pos && !dh4Neg;                     // NEUTRE (inclut null)

    if (side === "BUY") {
      switch (intradayLevel) {
        // IC UP → CONT si H4 UP, REV si H4 DOWN (H4 qui se retourne)
        case "SOFT_UP":
          if (h4Up)   return (dh4Pos || dh4Neu) ? { type: "CONTINUATION" } : null; // DOWN- → WAIT
          if (h4Down) return dh4Pos               ? { type: "REVERSAL" }    : null; // strict
          return null;

        case "STRONG_UP":
          if (h4Up)   return (dh4Pos || dh4Neu) ? { type: "CONTINUATION" } : null;
          if (h4Down) return dh4Pos               ? { type: "REVERSAL" }    : null; // (conditions)
          return null;

        case "EXPLOSIVE_UP":
          if (h4Up)   return dh4Neg ? null : { type: "CONTINUATION" };             // DOWN- → WAIT
          if (h4Down) return dh4Pos ? { type: "REVERSAL" } : null;                 // (conditions)
          return null;

        // SPIKE IC UP + H4 DOWN → REV BUY spike (SPIKE dans sens H4 → WAIT)
        case "SPIKE_UP":
          if (h4Down && (dh4Pos || dh4Neu)) return { type: "REVERSAL", mode: "spike" };
          return null;

        // IC NEUTRE, DOWN → WAIT pour BUY
        default:
          return null;
      }
    }

    if (side === "SELL") {
      switch (intradayLevel) {
        // IC DOWN → CONT si H4 DOWN, REV si H4 UP (H4 qui se retourne)
        case "SOFT_DOWN":
          if (h4Down) return (dh4Neg || dh4Neu) ? { type: "CONTINUATION" } : null; // UP+ → WAIT
          if (h4Up)   return dh4Neg               ? { type: "REVERSAL" }    : null; // strict
          return null;

        case "STRONG_DOWN":
          if (h4Down) return (dh4Neg || dh4Neu) ? { type: "CONTINUATION" } : null;
          if (h4Up)   return dh4Neg               ? { type: "REVERSAL" }    : null; // (conditions)
          return null;

        case "EXPLOSIVE_DOWN":
          if (h4Down) return dh4Pos ? null : { type: "CONTINUATION" };             // UP+ → WAIT
          if (h4Up)   return dh4Neg ? { type: "REVERSAL" } : null;                 // (conditions)
          return null;

        // SPIKE IC DOWN + H4 UP → REV SELL spike (SPIKE dans sens H4 → WAIT)
        case "SPIKE_DOWN":
          if (h4Up && (dh4Neg || dh4Neu)) return { type: "REVERSAL", mode: "spike" };
          return null;

        // IC NEUTRE, UP → WAIT pour SELL
        default:
          return null;
      }
    }

    return null;
  }

  // ============================================================================
  // GATE 3 — Alignment score → mode (relaxed / soft / normal / strict)
  //
  // CONTINUATION / STANDARD :
  //   aligned = nb de TFs (Daily, H4, H1) dans la direction du trade
  //   3 alignés + drsi_h1 OK → RELAXED
  //   3 alignés                → SOFT
  //   2 alignés + drsi_h1 OK → SOFT
  //   2 alignés                → NORMAL
  //   ≤ 1                      → STRICT
  //
  // REVERSAL :
  //   confirmed = nb de TFs dans la direction OPPOSÉE (confirme le contexte)
  //   3 confirmés → RELAXED
  //   2 confirmés → SOFT
  //   1 confirmé  → NORMAL
  //   0           → STRICT
  // ============================================================================
  // STRONG = STRONG / EXPLOSIVE / SPIKE (exclut SOFT)
  const STRONG_UP_LEVELS   = ["STRONG_UP","EXPLOSIVE_UP","SPIKE_UP"];
  const STRONG_DOWN_LEVELS = ["STRONG_DOWN","EXPLOSIVE_DOWN","SPIKE_DOWN"];

  function computeMode(type, side, intradayLevel, slopeH4Level, slopeH1Level,
                       drsi_h1, drsi_h4) {
    const inUp  = UP_HALF.includes(intradayLevel);
    const h4Up  = UP_HALF.includes(slopeH4Level);
    const h1Up  = UP_HALF.includes(slopeH1Level);
    const inDn  = DOWN_HALF.includes(intradayLevel);
    const h4Dn  = DOWN_HALF.includes(slopeH4Level);
    const h1Dn  = DOWN_HALF.includes(slopeH1Level);

    // STRONG = STRONG/EXPLOSIVE/SPIKE — exclut SOFT pour RELAXED
    const isStrongDir = side === "BUY" ? STRONG_UP_LEVELS : STRONG_DOWN_LEVELS;
    const inStrg = isStrongDir.includes(intradayLevel);
    const h4Strg = isStrongDir.includes(slopeH4Level);
    const h1Strg = isStrongDir.includes(slopeH1Level);

    const drsiOk = side === "BUY"
      ? (drsi_h1 !== null && drsi_h1 > 0)
      : (drsi_h1 !== null && drsi_h1 < 0);

    if (type === "REVERSAL") {
      // Combien de TFs confirment le contexte opposé (DOWN pour BUY REV)
      const conf = side === "BUY"
        ? [inDn, h4Dn, h1Dn].filter(Boolean).length
        : [inUp, h4Up, h1Up].filter(Boolean).length;
      // Pour REVERSAL RELAXED : 3 TFs confirmés dont au moins 2 en STRONG
      const confStrg = side === "BUY"
        ? [STRONG_DOWN_LEVELS.includes(intradayLevel), STRONG_DOWN_LEVELS.includes(slopeH4Level), STRONG_DOWN_LEVELS.includes(slopeH1Level)].filter(Boolean).length
        : [STRONG_UP_LEVELS.includes(intradayLevel), STRONG_UP_LEVELS.includes(slopeH4Level), STRONG_UP_LEVELS.includes(slopeH1Level)].filter(Boolean).length;
      if (conf === 3 && confStrg >= 2) return "relaxed";
      if (conf === 3)                  return "soft";
      if (conf === 2)                  return "soft";
      if (conf >= 1)                   return "normal";
      return "strict";
    }

    // CONTINUATION / STANDARD
    const aligned = side === "BUY"
      ? [inUp, h4Up, h1Up].filter(Boolean).length
      : [inDn, h4Dn, h1Dn].filter(Boolean).length;
    const strong = [inStrg, h4Strg, h1Strg].filter(Boolean).length;

    // RELAXED : triple alignement dont au moins 2 TFs en STRONG + drsi ok
    if (aligned === 3 && strong >= 2 && drsiOk) return "relaxed";
    // SOFT : triple alignement (avec drsi) ou double strong
    if (aligned === 3 && drsiOk)                return "soft";
    if (aligned === 3)                          return "soft";
    if (aligned >= 2 && strong >= 1 && drsiOk)  return "soft";
    if (aligned >= 2)                           return "normal";
    return "strict";
  }

  // ============================================================================
  // GATE PRESETS — 5 niveaux : spike > relaxed > soft > normal > strict
  // ============================================================================
  function buildGates(side, mode, type) {
    const isRev = (type === "REVERSAL");

    // SPIKE — bypass total, seul anti-spike drsi reste
    if (mode === "spike") {
      return {
        drsiH1S0Required: false,
        drsiH1Min: 0, dslopeRev: 0, zRev: -99,
        dslope: 0,
        z3050: -99, z5070: -99,
        dslope7075: 0, z7075: 99,
        drsiH4Sum: null,
      };
    }

    if (mode === "relaxed") {
      return isRev ? {
        // REVERSAL relaxed — triple confirmation DOWN, tolérant
        drsiH1S0Required: false,
        drsiH1Min: 0, dslopeRev: 0, zRev: -0.3,
        dslope: 0,
        z3050: -0.5, z5070: 0.5,
        dslope7075: 0, z7075: 3.0,
        drsiH4Sum: null,
      } : {
        // CONTINUATION relaxed — triple alignement confirmé
        drsiH1S0Required: false,
        drsiH1Min: 0, dslopeRev: 0, zRev: -0.3,
        dslope: 0,
        z3050: 2.5, z5070: 1.5,
        dslope7075: 0, z7075: 4.0,
        drsiH4Sum: null,
      };
    }

    if (mode === "soft") {
      return isRev ? {
        // REVERSAL soft — double confirmation
        drsiH1S0Required: false,
        drsiH1Min: 0.3, dslopeRev: 0.1, zRev: -0.4,
        dslope: 0.3,
        z3050: -1.0, z5070: 0,
        dslope7075: 0.1, z7075: 2.5,
        drsiH4Sum: null,
      } : {
        // CONTINUATION soft — double alignement + drsi ok
        drsiH1S0Required: false,
        drsiH1Min: 0.3, dslopeRev: 0.1, zRev: -0.3,
        dslope: 0.2,
        z3050: 2.0, z5070: 1.5,
        dslope7075: 0.1, z7075: 3.0,
        drsiH4Sum: 0,
      };
    }

    if (mode === "normal") {
      return isRev ? {
        // REVERSAL normal — single confirmation
        drsiH1S0Required: true,
        drsiH1Min: 0.5, dslopeRev: 0.25, zRev: -0.5,
        dslope: 0.8,
        z3050: -1.3, z5070: -0.5,
        dslope7075: 0.2, z7075: 2.0,
        drsiH4Sum: null,
      } : {
        // CONTINUATION normal — double alignement sans drsi
        drsiH1S0Required: true,
        drsiH1Min: 0.5, dslopeRev: 0.25, zRev: -0.3,
        dslope: 0.5,
        z3050: 1.5, z5070: 1.2,
        dslope7075: 0, z7075: 2.5,
        drsiH4Sum: 0,
      };
    }

    // STRICT — alignement faible ou absent
    return isRev ? {
      drsiH1S0Required: true,
      drsiH1Min: 1.0, dslopeRev: 0.5, zRev: -0.8,
      dslope: 1.5,
      z3050: -2.0, z5070: -1.0,
      dslope7075: 0.5, z7075: 1.5,
      drsiH4Sum: null,
    } : {
      drsiH1S0Required: true,
      drsiH1Min: 1.0, dslopeRev: 0.5, zRev: -1.0,
      dslope: 1.2,
      z3050: 0, z5070: 0.5,
      dslope7075: 0.3, z7075: 1.5,
      drsiH4Sum: 0.5,
    };
  }

  // ============================================================================
  // GATE UNIVERSEL DRSI — percentile conditionnel par asset × intradayLevel
  //
  // Principe : drsi_h1 = 0 ne veut rien dire en absolu. Ce qui compte c'est
  // sa position dans la distribution conditionnelle du régime intraday.
  //
  // REVERSAL (contre contexte) :
  //   BUY  → drsi_h1 >= P75 du contexte  (top 25% = momentum H1 réellement bullish)
  //   SELL → drsi_h1 <= P25 du contexte  (bottom 25% = momentum H1 réellement bearish)
  //   H4   → P50 (un niveau plus souple)
  //
  // CONTINUATION / STANDARD (avec contexte) :
  //   BUY  → drsi_h1 >= P50  (au-dessus de la médiane du contexte)
  //   SELL → drsi_h1 <= P50
  //   H4   → P25 / P75 (seuil d'exclusion des extrêmes opposés)
  //
  // Fallback seuils fixes pour assets sans DrsiConfig
  // spike mode → bypass via l'appelant
  // ============================================================================
  function drsiContextGate(side, type, intradayLevel, drsi_h1_s0, drsi_h4_s0, symbol) {
    const cfg = getDrsiConfig(symbol, intradayLevel);

    if (cfg?.h1) {
      const isRev = (type === "REVERSAL");
      const h1 = cfg.h1;
      const h4 = cfg.h4;

      if (side === "BUY") {
        const h1Thr = isRev ? h1.p75 : h1.p50;
        if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Thr) return false;
        if (h4 && drsi_h4_s0 !== null) {
          const h4Thr = isRev ? h4.p50 : h4.p25;
          if (drsi_h4_s0 < h4Thr) return false;
        }
      } else {
        const h1Thr = isRev ? h1.p25 : h1.p50;
        if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Thr) return false;
        if (h4 && drsi_h4_s0 !== null) {
          const h4Thr = isRev ? h4.p50 : h4.p75;
          if (drsi_h4_s0 > h4Thr) return false;
        }
      }
      return true;
    }

    // Fallback : seuils fixes (assets non couverts par DrsiConfig)
    if (side === "SELL") {
      const SELL_FLOOR = {
        SOFT_UP:[-0.20,-0.10], STRONG_UP:[-0.50,-0.30], EXPLOSIVE_UP:[-1.00,-0.50],
        NEUTRE:[-0.40,0], SOFT_DOWN:[-0.35,0], STRONG_DOWN:[-0.25,0], EXPLOSIVE_DOWN:[-0.20,0],
      };
      const [h1Min, h4Min] = SELL_FLOOR[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Min) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 > h4Min) return false;
    } else {
      const BUY_CEIL = {
        SOFT_DOWN:[0.20,0.10], STRONG_DOWN:[0.50,0.30], EXPLOSIVE_DOWN:[1.00,0.50],
        NEUTRE:[0.40,0], SOFT_UP:[0.35,0], STRONG_UP:[0.25,0], EXPLOSIVE_UP:[0.20,0],
      };
      const [h1Max, h4Max] = BUY_CEIL[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Max) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 < h4Max) return false;
    }
    return true;
  }

  // ============================================================================
  // SPACING / DEDUPE
  // ============================================================================
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

  // ============================================================================
  // NIVEAU 2 — BUY ROUTES (sans slope gates — geres par resolve3D)
  // ============================================================================
  function matchBuyRoute(
    rsi_s1, slope_h1, dslope_h1, drsi_h1, zscore_h1,
    zscore_h1_min3, zscore_h1_max3,
    slope_h1_s0, drsi_h1_s0, zscore_h1_s0,
    drsi_h4, drsi_h4_s0, slope_h4, slope_h4_s0,
    rsi_h1_s0,
    g
  ) {
    const rsi = rsi_h1_s0 !== null ? rsi_h1_s0 : rsi_s1;
    if (rsi === null || dslope_h1 === null || zscore_h1 === null) return null;

    const zscore = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
    const drsi_h1_live = (rsi_h1_s0 !== null && rsi_s1 !== null)
      ? rsi_h1_s0 - rsi_s1 : drsi_h1;

    const drsiSafe    = drsi_h1_live === null || Math.abs(drsi_h1_live) < 8;
    const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
    const h4BuyOk     = drsi_h4_eff === null || drsi_h4_eff >= -0.3;
    const drsiH4Ok    = drsi_h4_s0 !== null && drsi_h4_s0 > 0;

    // BUY [0-28] — extreme oversold
    if (rsi < 28
     && drsi_h1_live !== null && drsi_h1_live > g.drsiH1Min
     && drsiH4Ok
     && dslope_h1 > g.dslopeRev
     && zscore < g.zRev)
      return { route: "BUY-[0-28]", side: "BUY" };

    // BUY [28-50] — low-mid zone
    if (rsi >= 28 && rsi < 50
     && zscore < g.z3050
     && dslope_h1 > g.dslope
     && drsiSafe && h4BuyOk)
      return { route: "BUY-[28-50]", side: "BUY" };

    // BUY [50-72] — mid-high zone
    if (rsi >= 50 && rsi < 72
     && zscore < g.z5070
     && dslope_h1 > g.dslope
     && drsiSafe && h4BuyOk)
      return { route: "BUY-[50-72]", side: "BUY" };

    return null;
  }

  // ============================================================================
  // SELL ROUTES (miroir)
  // ============================================================================
  function matchSellRoute(
    rsi_s1, slope_h1, dslope_h1, drsi_h1, zscore_h1,
    zscore_h1_min3, zscore_h1_max3,
    slope_h1_s0, drsi_h1_s0, zscore_h1_s0,
    drsi_h4, drsi_h4_s0, slope_h4, slope_h4_s0,
    rsi_h1_s0,
    g
  ) {
    const rsi = rsi_h1_s0 !== null ? rsi_h1_s0 : rsi_s1;
    if (rsi === null || dslope_h1 === null || zscore_h1 === null) return null;

    const zscore = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
    const drsi_h1_live = (rsi_h1_s0 !== null && rsi_s1 !== null)
      ? rsi_h1_s0 - rsi_s1 : drsi_h1;

    const drsiSafe    = drsi_h1_live === null || Math.abs(drsi_h1_live) < 8;
    const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
    const h4SellOk    = drsi_h4_eff === null || drsi_h4_eff <= 0.3;
    const drsiH4Ok    = drsi_h4_s0 !== null && drsi_h4_s0 < 0;

    // SELL [72-100] — extreme overbought
    if (rsi >= 72
     && drsi_h1_live !== null && drsi_h1_live < -g.drsiH1Min
     && drsiH4Ok
     && dslope_h1 < -g.dslopeRev
     && zscore > -g.zRev)
      return { route: "SELL-[72-100]", side: "SELL" };

    // SELL [50-72] — mid-high zone
    if (rsi >= 50 && rsi < 72
     && zscore > -g.z3050
     && dslope_h1 < -g.dslope
     && drsiSafe && h4SellOk)
      return { route: "SELL-[50-72]", side: "SELL" };

    // SELL [28-50] — low-mid zone
    if (rsi >= 28 && rsi < 50
     && zscore > -g.z5070
     && dslope_h1 < -g.dslope
     && drsiSafe && h4SellOk)
      return { route: "SELL-[28-50]", side: "SELL" };

    return null;
  }

  // =========================
  // ROUTE => SIGNAL PHASE
  // =========================
  const ROUTE_PHASE = {
    "BUY-[0-28]":    "EXTREME_LOW",
    "BUY-[28-50]":   "LOW_MID",
    "BUY-[50-72]":   "MID_HIGH",
    "SELL-[72-100]": "EXTREME_HIGH",
    "SELL-[50-72]":  "MID_HIGH",
    "SELL-[28-50]":  "LOW_MID",
  };

  // =========================
  // MAIN
  // =========================
  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const symbol = rows[0]?.symbol;
    if (!symbol) return [];

    const riskCfg  = getRiskConfig(symbol);
    const intCfg   = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
    const slopeCfg = getSlopeConfig(symbol);
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

      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 2 * atrH1Cap) continue;

      // Niveau 1 : contexte intraday
      const intra = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      // Niveau 1b : regimes slope H4 et H1 (s0 prioritaire, fallback s1)
      const slope_h4_raw = num(row?.slope_h4_s0) !== null
        ? num(row.slope_h4_s0) : num(row?.slope_h4);
      const slope_h1_raw = num(row?.slope_h1_s0) !== null
        ? num(row.slope_h1_s0) : num(row?.slope_h1);
      const slopeH4Level = getSlopeRegime(slope_h4_raw, slopeCfg.h4);
      const slopeH1Level = getSlopeRegime(slope_h1_raw, slopeCfg.h1);

      // Indicateurs communs
      const args = [
        num(row?.rsi_h1), num(row?.slope_h1), num(row?.dslope_h1),
        num(row?.drsi_h1), num(row?.zscore_h1),
        num(row?.zscore_h1_min3), num(row?.zscore_h1_max3),
        num(row?.slope_h1_s0), num(row?.drsi_h1_s0), num(row?.zscore_h1_s0),
        num(row?.drsi_h4), num(row?.drsi_h4_s0),
        num(row?.slope_h4), num(row?.slope_h4_s0),
        num(row?.rsi_h1_s0),
      ];

      // Pre-compute drsi live pour Gate 3
      const drsi_h1_live = num(row?.drsi_h1_s0) ?? num(row?.drsi_h1);
      const drsi_h4_live = num(row?.drsi_h4_s0) ?? num(row?.drsi_h4);

      // dslopeH4 — clé de resolve3D (pas de s0 dispo pour dslope_h4)
      const dslopeH4   = num(row?.dslope_h4);
      const dslopeH4Thr = slopeCfg.dslopeH4Thr ?? 1;

      // Gate 1 → type  /  Gate 3 → mode  /  Gate 2 → route RSI
      let match = null;
      let signalType = null;
      let signalMode = null;

      const buyRes = resolve3D(intradayLevel, slopeH4Level, dslopeH4, "BUY", dslopeH4Thr);
      if (buyRes) {
        const buyMode = buyRes.mode ?? computeMode(
          buyRes.type, "BUY", intradayLevel, slopeH4Level, slopeH1Level,
          drsi_h1_live, drsi_h4_live);
        const gBuy = buildGates("BUY", buyMode, buyRes.type);
        match = matchBuyRoute(...args, gBuy);
        if (match) {
          signalType = buyRes.type;
          signalMode = buyMode;
        }
      }

      // SELL si BUY n'a pas matche
      if (!match) {
        const sellRes = resolve3D(intradayLevel, slopeH4Level, dslopeH4, "SELL", dslopeH4Thr);
        if (sellRes) {
          const sellMode = sellRes.mode ?? computeMode(
            sellRes.type, "SELL", intradayLevel, slopeH4Level, slopeH1Level,
            drsi_h1_live, drsi_h4_live);
          const gSell = buildGates("SELL", sellMode, sellRes.type);
          match = matchSellRoute(...args, gSell);
          if (match) {
            signalType = sellRes.type;
            signalMode = sellMode;
          }
        }
      }

      if (!match) continue;

      // Anti-spike drsi H1
      const _drsi_h1    = num(row?.drsi_h1);
      const _drsi_h1_s0 = num(row?.drsi_h1_s0);
      const _drsi_h4_s0 = num(row?.drsi_h4_s0);
      if (_drsi_h1    !== null && Math.abs(_drsi_h1)    >= 8) continue;
      if (_drsi_h1_s0 !== null && Math.abs(_drsi_h1_s0) >= 8) continue;

      // Gate universel drsi s0 — percentile conditionnel (spike bypass)
      if (signalMode !== "spike" && !drsiContextGate(match.side, signalType, intradayLevel, _drsi_h1_s0, _drsi_h4_s0, symbol)) continue;

      // Reversal kill switch
      if (signalType === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      const score = signalType === "REVERSAL" ? 80 : Math.max(0, Math.round(
        Math.abs(num(row?.slope_h1) ?? 0) * 50 +
        Math.abs((num(row?.rsi_h1) ?? 50) - 50) * 2
      ));

      if (score < TOP_CFG.scoreMin) continue;

      opps.push({
        type:        signalType,
        mode:        signalMode,
        regime:      `${signalType}_${match.side}`,
        route:       match.route,
        signalPhase: ROUTE_PHASE[match.route] ?? match.route,
        engine:      "V8R",
        index:       i,
        timestamp:   row?.timestamp,
        symbol,
        side:        match.side,
        signalType:  match.side,
        score,
        intradayLevel,
        slopeH4Level,
        slopeH1Level,

        // H4
        slope_h4:    num(row?.slope_h4),
        dslope_h4:   num(row?.dslope_h4),
        drsi_h4:     num(row?.drsi_h4),
        rsi_h4_s0:   num(row?.rsi_h4_s0),
        slope_h4_s0: num(row?.slope_h4_s0),
        drsi_h4_s0:  num(row?.drsi_h4_s0),

        // H1 s1
        rsi_h1:      num(row?.rsi_h1),
        slope_h1:    num(row?.slope_h1),
        dslope_h1:   num(row?.dslope_h1),
        drsi_h1:     num(row?.drsi_h1),
        zscore_h1:   num(row?.zscore_h1),
        dz_h1:       num(row?.dz_h1),
        atr_h1:      num(row?.atr_h1),
        zscore_h1_min3: num(row?.zscore_h1_min3),
        zscore_h1_max3: num(row?.zscore_h1_max3),

        // H1 s0
        rsi_h1_s0:    num(row?.rsi_h1_s0),
        slope_h1_s0:  num(row?.slope_h1_s0),
        drsi_h1_s0:   num(row?.drsi_h1_s0),
        zscore_h1_s0: num(row?.zscore_h1_s0),

        // M15
        atr_m15:     num(row?.atr_m15),
        rsi_m15:     num(row?.rsi_m15),
        slope_m15:   num(row?.slope_m15),
        dslope_m15:  num(row?.dslope_m15),

        // M5 s1
        rsi_m5:      num(row?.rsi_m5),
        slope_m5:    num(row?.slope_m5),
        dslope_m5:   num(row?.dslope_m5),
        drsi_m5:     num(row?.drsi_m5),
        zscore_m5:   num(row?.zscore_m5),

        // M5 s0
        rsi_m5_s0:    num(row?.rsi_m5_s0),
        slope_m5_s0:  num(row?.slope_m5_s0),
        drsi_m5_s0:   num(row?.drsi_m5_s0),
        zscore_m5_s0: num(row?.zscore_m5_s0),

        close:           num(row?.close),
        intraday_change: intra,
      });
    }

    opps.sort((a, b) => {
      const sa = a.score ?? 0, sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""));
    });

    opps = applyDedupeAndSpacing(opps, TOP_CFG);

    if (TOP_CFG.debug) {
      console.info("TOPOPP V8R", {
        total_rows: rows.length,
        signals:    opps.length,
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_V8R;
