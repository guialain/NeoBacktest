// ============================================================================
// TopOpportunities_V9.js — H1 ROUTER V9
//
// ARCHI
// resolve3D (macro)
// ↓
// type (CONT / REV / EARLY)
// ↓
// mode (strict → relaxed)
// ↓
// Zscore gate (simple, propre)
// ↓
// RSI + drsi (timing)
//
// REVERSAL logic:
//   REV SELL = slopeH4 S1 (stale) UP  + IC UP  + dslope_h4 (live) < -0.3 + dslope_h1 (live) < -1
//   REV BUY  = slopeH4 S1 (stale) DOWN + IC DOWN + dslope_h4 (live) > +0.3 + dslope_h1 (live) > +1
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";
import { INTRADAY_CONFIG } from "../config/IntradayConfig.js";
import { getSlopeConfig } from "../config/SlopeConfig.js";
import { getDrsiConfig } from "../config/DrsiConfig.js";

const TopOpportunities_V9 = (() => {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // NIVEAU 1 — REGIME FUNCTIONS
  // ============================================================================
  function getIntradayLevel(intra, cfg) {
    if (intra === null) return "NEUTRE";
    if (intra > cfg.spikeUp) return "SPIKE_UP";
    if (intra >= cfg.explosiveUp) return "EXPLOSIVE_UP";
    if (intra >= cfg.strongUp) return "STRONG_UP";
    if (intra >= cfg.softUp) return "SOFT_UP";
    if (intra > cfg.softDown) return "NEUTRE";
    if (intra > cfg.strongDown) return "SOFT_DOWN";
    if (intra > cfg.explosiveDown) return "STRONG_DOWN";
    if (intra > cfg.spikeDown) return "EXPLOSIVE_DOWN";
    return "SPIKE_DOWN";
  }

  function getSlopeRegime(slope, cfg) {
    if (slope === null || !cfg) return "NEUTRE";
    if (slope > cfg.spikeUp) return "SPIKE_UP";
    if (slope >= cfg.explosiveUp) return "EXPLOSIVE_UP";
    if (slope >= cfg.strongUp) return "STRONG_UP";
    if (slope >= cfg.softUp) return "SOFT_UP";
    if (slope > cfg.softDown) return "NEUTRE";
    if (slope > cfg.strongDown) return "SOFT_DOWN";
    if (slope > cfg.explosiveDown) return "STRONG_DOWN";
    if (slope > cfg.spikeDown) return "EXPLOSIVE_DOWN";
    return "SPIKE_DOWN";
  }

  // ============================================================================
  // 3D RESOLUTION
  //
  // CONT/EARLY : utilisent slopeH4Level (s0 prioritaire — live)
  // REVERSAL   : utilisent slopeH4LevelS1 (s1 stale — tendance établie)
  //              + dslope_h4 live + dslope_h1 live pour confirmer le retournement
  //
  //   CONT BUY  : slopeH4 (live) UP   + IC UP
  //   CONT SELL : slopeH4 (live) DOWN + IC DOWN
  //   REV BUY   : slopeH4 (stale) DOWN + IC DOWN + dslope_h4 > +0.3 + dslope_h1 > +1
  //   REV SELL  : slopeH4 (stale) UP   + IC UP   + dslope_h4 < -0.3 + dslope_h1 < -1
  //   EARLY BUY : IC NEUTRE + H4 STRONG_UP (live) + drsiH4S0 up
  //   EARLY SELL: IC NEUTRE + H4 STRONG_DOWN (live) + drsiH4S0 down
  //   SPIKE     : IC SPIKE contre H4 (live)
  // ============================================================================
  function resolve3D(intradayLevel, slopeH4Level, slopeH4LevelS1, drsiH4S0, dslopeH4Live, dslopeH1Live, side, thr = 0.3) {

    // CONT / EARLY / SPIKE — slope H4 live
    const h4Up =
      slopeH4Level === "SOFT_UP" ||
      slopeH4Level === "STRONG_UP" ||
      slopeH4Level === "EXPLOSIVE_UP";

    const h4Down =
      slopeH4Level === "SOFT_DOWN" ||
      slopeH4Level === "STRONG_DOWN" ||
      slopeH4Level === "EXPLOSIVE_DOWN";

    // REVERSAL — slope H4 stale (tendance établie)
    const h4UpS1 =
      slopeH4LevelS1 === "SOFT_UP" ||
      slopeH4LevelS1 === "STRONG_UP" ||
      slopeH4LevelS1 === "EXPLOSIVE_UP";

    const h4DownS1 =
      slopeH4LevelS1 === "SOFT_DOWN" ||
      slopeH4LevelS1 === "STRONG_DOWN" ||
      slopeH4LevelS1 === "EXPLOSIVE_DOWN";

    const dh4Up   = drsiH4S0 !== null && drsiH4S0 >=  thr;
    const dh4Down = drsiH4S0 !== null && drsiH4S0 <= -thr;
    const dh4OkBuy  = dh4Up  || (!dh4Up && !dh4Down);
    const dh4OkSell = dh4Down || (!dh4Up && !dh4Down);

    const isUpIC =
      intradayLevel === "SOFT_UP" ||
      intradayLevel === "STRONG_UP" ||
      intradayLevel === "EXPLOSIVE_UP";

    const isDownIC =
      intradayLevel === "SOFT_DOWN" ||
      intradayLevel === "STRONG_DOWN" ||
      intradayLevel === "EXPLOSIVE_DOWN";

    if (side === "BUY") {
      if (intradayLevel === "NEUTRE") {
        const h4Strong = slopeH4Level === "STRONG_UP" || slopeH4Level === "EXPLOSIVE_UP";
        return dh4Up && h4Strong ? { type: "EARLY" } : null;
      }
      if (intradayLevel === "SPIKE_DOWN")
        return h4Up && dh4OkBuy ? { type: "REVERSAL", mode: "spike" } : null;
      if (intradayLevel === "SPIKE_UP") return null;

      // CONT BUY — slopeH4 live UP + IC UP
      if (h4Up && isUpIC) return dh4OkBuy ? { type: "CONTINUATION" } : null;

      // REV BUY — slopeH4 stale DOWN + IC DOWN + dslope_h4 live remonte + dslope_h1 live remonte
      if (h4DownS1 && isDownIC) {
        const revConfirm =
          (dslopeH4Live !== null && dslopeH4Live >  0.3) &&
          (dslopeH1Live !== null && dslopeH1Live >  1);
        return revConfirm ? { type: "REVERSAL" } : null;
      }

      return null;
    }

    if (side === "SELL") {
      if (intradayLevel === "NEUTRE") {
        const h4Strong = slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN";
        return dh4Down && h4Strong ? { type: "EARLY" } : null;
      }
      if (intradayLevel === "SPIKE_UP")
        return h4Down && dh4OkSell ? { type: "REVERSAL", mode: "spike" } : null;
      if (intradayLevel === "SPIKE_DOWN") return null;

      // CONT SELL — slopeH4 live DOWN + IC DOWN
      if (h4Down && isDownIC) return dh4OkSell ? { type: "CONTINUATION" } : null;

      // REV SELL — slopeH4 stale UP + IC UP + dslope_h4 live fléchit + dslope_h1 live fléchit
      if (h4UpS1 && isUpIC) {
        const revConfirm =
          (dslopeH4Live !== null && dslopeH4Live < -0.3) &&
          (dslopeH1Live !== null && dslopeH1Live < -1);
        return revConfirm ? { type: "REVERSAL" } : null;
      }

      return null;
    }

    return null;
  }

  // ============================================================================
  // MODE — qualité du setup (inchangé)
  // ============================================================================
  const STRONG_UP_LEVELS   = ["STRONG_UP", "EXPLOSIVE_UP", "SPIKE_UP"];
  const STRONG_DOWN_LEVELS = ["STRONG_DOWN", "EXPLOSIVE_DOWN", "SPIKE_DOWN"];

  function computeMode(type, side, intradayLevel, slopeH4Level, drsiH4S0, thr) {
    const dh4Confirm =
      side === "BUY"
        ? drsiH4S0 !== null && drsiH4S0 >= thr
        : drsiH4S0 !== null && drsiH4S0 <= -thr;

    const icStrong =
      side === "BUY"
        ? type === "REVERSAL"
          ? STRONG_DOWN_LEVELS.includes(intradayLevel)
          : STRONG_UP_LEVELS.includes(intradayLevel)
        : type === "REVERSAL"
          ? STRONG_UP_LEVELS.includes(intradayLevel)
          : STRONG_DOWN_LEVELS.includes(intradayLevel);

    const h4Strong =
      side === "BUY"
        ? slopeH4Level === "STRONG_UP"   || slopeH4Level === "EXPLOSIVE_UP"
        : slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN";

    const conf = [icStrong, h4Strong, dh4Confirm].filter(Boolean).length;
    if (conf === 3) return "relaxed";
    if (conf === 2) return "soft";
    if (conf >= 1)  return "normal";
    return "strict";
  }

  // ============================================================================
  // ZSCORE THRESHOLDS (inchangé)
  // ============================================================================
  function getZscoreThresholds(mode) {
    const CONT = {
      strict: 2.0, normal: 2.2, soft: 2.5, relaxed: 2.8, spike: 99,
    };
    const REV = {
      strict: 1.5, normal: 1.2, soft: 1.0, relaxed: 0.8, spike: 0.5,
    };
    const EARLY = {
      strict: 1.8, normal: 2.0, soft: 2.2, relaxed: 2.5, spike: 99,
    };
    return {
      cont:  CONT[mode]  ?? 1.5,
      rev:   REV[mode]   ?? 1.2,
      early: EARLY[mode] ?? 1.0,
    };
  }

  function passZscoreGate({ side, type, mode, zscore, dz, zscoreH4 }) {
    if (zscore === null) return false;
    if (type !== "CONTINUATION" && Math.abs(zscore) > 3) return false;

    if (zscoreH4 !== null) {
      if (side === "BUY"  && zscoreH4 >  1.95) return false;
      if (side === "SELL" && zscoreH4 < -1.95) return false;
    }

    const { cont, rev, early } = getZscoreThresholds(mode);
    const dzOkBuy  = dz === null || dz >= 0;
    const dzOkSell = dz === null || dz <= 0;

    if (type === "CONTINUATION") {
      if (side === "BUY")  return zscore < cont  && dzOkBuy;
      if (side === "SELL") return zscore > -cont && dzOkSell;
    }
    if (type === "REVERSAL") {
      if (side === "BUY")  return zscore < -rev && dzOkBuy;
      if (side === "SELL") return zscore > rev  && dzOkSell;
    }
    if (type === "EARLY") {
      if (side === "BUY")  return zscore < early  && dzOkBuy;
      if (side === "SELL") return zscore > -early && dzOkSell;
    }
    return false;
  }

  // ============================================================================
  // DRSI CONTEXT GATE (inchangé)
  // ============================================================================
  function drsiContextGate(side, type, intradayLevel, drsi_h1_s0, drsi_h4_s0, symbol) {
    const cfg = getDrsiConfig(symbol, intradayLevel);

    if (cfg?.h1) {
      const isRev = type === "REVERSAL" || type === "EARLY";
      const h1 = cfg.h1;
      const h4 = cfg.h4;

      if (side === "BUY") {
        const h1Thr = isRev ? h1.p50 : h1.p25;
        if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Thr) return false;
        if (h4 && drsi_h4_s0 !== null) {
          const h4Thr = isRev ? h4.p50 : h4.p25;
          if (drsi_h4_s0 < h4Thr) return false;
        }
      } else {
        const h1Thr = isRev ? h1.p50 : h1.p75;
        if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Thr) return false;
        if (h4 && drsi_h4_s0 !== null) {
          const h4Thr = isRev ? h4.p50 : h4.p75;
          if (drsi_h4_s0 > h4Thr) return false;
        }
      }
      return true;
    }

    if (side === "SELL") {
      const SELL_FLOOR = {
        SOFT_UP: [-0.20, -0.10], STRONG_UP: [-0.50, -0.30], EXPLOSIVE_UP: [-1.00, -0.50],
        NEUTRE: [-0.40, 0], SOFT_DOWN: [-0.35, 0], STRONG_DOWN: [-0.25, 0], EXPLOSIVE_DOWN: [-0.20, 0],
      };
      const [h1Min, h4Min] = SELL_FLOOR[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Min) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 > h4Min) return false;
    } else {
      const BUY_CEIL = {
        SOFT_DOWN: [0.20, 0.10], STRONG_DOWN: [0.50, 0.30], EXPLOSIVE_DOWN: [1.00, 0.50],
        NEUTRE: [0.40, 0], SOFT_UP: [0.35, 0], STRONG_UP: [0.25, 0], EXPLOSIVE_UP: [0.20, 0],
      };
      const [h1Max, h4Max] = BUY_CEIL[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Max) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 < h4Max) return false;
    }
    return true;
  }

  // ============================================================================
  // RSI + DRSI TIMING (inchangé)
  // ============================================================================
  function matchBuyRoute(rsi_h1_s0, drsi_h1_s0, dslope_h1_live, type) {
    if (rsi_h1_s0 === null || drsi_h1_s0 === null) return null;
    const dslopeOk = dslope_h1_live === null || dslope_h1_live > -1;

    if (type === "CONTINUATION") {
      if (rsi_h1_s0 >= 28 && rsi_h1_s0 < 50 && drsi_h1_s0 > 0.3 && dslopeOk)
        return { route: "BUY-[28-50]", side: "BUY" };
      if (rsi_h1_s0 >= 50 && rsi_h1_s0 < 72 && drsi_h1_s0 > 0.3 && dslopeOk)
        return { route: "BUY-[50-72]", side: "BUY" };
      return null;
    }
    if (type === "REVERSAL") {
      if (rsi_h1_s0 < 35 && drsi_h1_s0 > 0 && dslopeOk)
        return { route: "BUY-REV-[0-35]", side: "BUY" };
      return null;
    }
    if (type === "EARLY") {
      if (rsi_h1_s0 >= 35 && rsi_h1_s0 < 60 && drsi_h1_s0 > 0.2 && dslopeOk)
        return { route: "BUY-EARLY-[35-60]", side: "BUY" };
      return null;
    }
    return null;
  }

  function matchSellRoute(rsi_h1_s0, drsi_h1_s0, dslope_h1_live, type) {
    if (rsi_h1_s0 === null || drsi_h1_s0 === null) return null;
    const dslopeOk = dslope_h1_live === null || dslope_h1_live < 1;

    if (type === "CONTINUATION") {
      if (rsi_h1_s0 >= 50 && rsi_h1_s0 < 72 && drsi_h1_s0 < -0.3 && dslopeOk)
        return { route: "SELL-[50-72]", side: "SELL" };
      if (rsi_h1_s0 >= 28 && rsi_h1_s0 < 50 && drsi_h1_s0 < -0.3 && dslopeOk)
        return { route: "SELL-[28-50]", side: "SELL" };
      return null;
    }
    if (type === "REVERSAL") {
      if (rsi_h1_s0 > 65 && drsi_h1_s0 < 0 && dslopeOk)
        return { route: "SELL-REV-[65-100]", side: "SELL" };
      return null;
    }
    if (type === "EARLY") {
      if (rsi_h1_s0 > 40 && rsi_h1_s0 <= 65 && drsi_h1_s0 < -0.2 && dslopeOk)
        return { route: "SELL-EARLY-[40-65]", side: "SELL" };
      return null;
    }
    return null;
  }

  const ROUTE_PHASE = {
    "BUY-[28-50]":        "LOW_MID",
    "BUY-[50-72]":        "MID_HIGH",
    "BUY-REV-[0-35]":     "REV_LOW",
    "BUY-EARLY-[35-60]":  "EARLY_LOW",
    "SELL-[50-72]":       "MID_HIGH",
    "SELL-[28-50]":       "LOW_MID",
    "SELL-REV-[65-100]":  "REV_HIGH",
    "SELL-EARLY-[40-65]": "EARLY_HIGH",
  };

  // ============================================================================
  // SPACING / DEDUPE
  // ============================================================================
  function minutesBetween(tsA, tsB) {
    if (!tsA || !tsB) return null;
    const toDate = (ts) => {
      const [d, t] = String(ts).split(" ");
      if (!d || !t) return null;
      const dt = new Date(`${d.replace(/\./g, "-")}T${t}:00`);
      return Number.isNaN(dt.getTime()) ? null : dt;
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
  // MAIN
  // ============================================================================
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

    const drsiH4Thr     = slopeCfg.dslopeH4Thr    ?? 0.3;
    const antiSpikeH1S0 = num(slopeCfg?.antiSpikeH1S0) ?? 8;
    const atrH1Cap      = num(riskCfg?.atrH1Cap);

    let opps = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 2 * atrH1Cap) continue;

      const drsi_h1    = num(row?.drsi_h1);
      const drsi_h1_s0 = num(row?.drsi_h1_s0);
      const drsi_h4_s0 = num(row?.drsi_h4_s0);

      if (drsi_h1    !== null && Math.abs(drsi_h1)    >= 8)             continue;
      if (drsi_h1_s0 !== null && Math.abs(drsi_h1_s0) >= antiSpikeH1S0) continue;

      const intra         = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      // slope H4 s1 (stale) — tendance établie, pour REVERSAL
      const slope_h4_s1_val  = num(row?.slope_h4);
      // slope H4 s0 prioritaire, fallback s1 — pour CONT/EARLY
      const slope_h4_s0_val  = num(row?.slope_h4_s0);
      const slope_h4_raw     = slope_h4_s0_val !== null ? slope_h4_s0_val : slope_h4_s1_val;

      const slopeH4Level    = getSlopeRegime(slope_h4_raw,    slopeCfg.h4);  // live — CONT/EARLY
      const slopeH4LevelS1  = getSlopeRegime(slope_h4_s1_val, slopeCfg.h4);  // stale — REVERSAL

      // dslope H4 live — variation de la slope H4 (colonne CSV)
      const dslopeH4Live = num(row?.dslope_h4);
      // dslope H1 live — variation de la slope H1 (colonne CSV)
      const dslopeH1Live = num(row?.dslope_h1);

      const zscore_h4    = num(row?.zscore_h4_s0) ?? num(row?.zscore_h4);
      const zscore_h1    = num(row?.zscore_h1_s0) ?? num(row?.zscore_h1);
      const zscore_h1_s1 = num(row?.zscore_h1);
      const dz_h1_live   = (zscore_h1 !== null && zscore_h1_s1 !== null)
        ? zscore_h1 - zscore_h1_s1 : null;

      const rsi_h1_s0       = num(row?.rsi_h1_s0) ?? num(row?.rsi_h1);
      const slope_h1_s0_val = num(row?.slope_h1_s0);
      const slope_h1_s1_val = num(row?.slope_h1);
      const dslope_h1_live  = (slope_h1_s0_val !== null && slope_h1_s1_val !== null)
        ? slope_h1_s0_val - slope_h1_s1_val : null;

      let match      = null;
      let signalType = null;
      let signalMode = null;

      const buyRes = resolve3D(intradayLevel, slopeH4Level, slopeH4LevelS1, drsi_h4_s0, dslopeH4Live, dslopeH1Live, "BUY", drsiH4Thr);
      if (buyRes) {
        const buyMode = buyRes.mode ?? computeMode(buyRes.type, "BUY", intradayLevel, slopeH4Level, drsi_h4_s0, drsiH4Thr);
        if (passZscoreGate({ side: "BUY", type: buyRes.type, mode: buyMode, zscore: zscore_h1, dz: dz_h1_live, zscoreH4: zscore_h4 })) {
          match = matchBuyRoute(rsi_h1_s0, drsi_h1_s0, dslope_h1_live, buyRes.type);
          if (match) { signalType = buyRes.type; signalMode = buyMode; }
        }
      }

      if (!match) {
        const sellRes = resolve3D(intradayLevel, slopeH4Level, slopeH4LevelS1, drsi_h4_s0, dslopeH4Live, dslopeH1Live, "SELL", drsiH4Thr);
        if (sellRes) {
          const sellMode = sellRes.mode ?? computeMode(sellRes.type, "SELL", intradayLevel, slopeH4Level, drsi_h4_s0, drsiH4Thr);
          if (passZscoreGate({ side: "SELL", type: sellRes.type, mode: sellMode, zscore: zscore_h1, dz: dz_h1_live, zscoreH4: zscore_h4 })) {
            match = matchSellRoute(rsi_h1_s0, drsi_h1_s0, dslope_h1_live, sellRes.type);
            if (match) { signalType = sellRes.type; signalMode = sellMode; }
          }
        }
      }

      if (!match) continue;

      if (signalMode !== "spike" && !drsiContextGate(match.side, signalType, intradayLevel, drsi_h1_s0, drsi_h4_s0, symbol)) continue;
      if (signalType === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      const score =
        signalType === "REVERSAL" ? 80 :
        signalType === "EARLY"    ? 70 :
        Math.max(0, Math.round(
          Math.abs(num(row?.slope_h1) ?? 0) * 50 +
          Math.abs((num(row?.rsi_h1)  ?? 50) - 50) * 2
        ));

      if (score < TOP_CFG.scoreMin) continue;

      opps.push({
        type:        signalType,
        mode:        signalMode,
        regime:      `${signalType}_${match.side}`,
        route:       match.route,
        signalPhase: ROUTE_PHASE[match.route] ?? match.route,
        engine:      "V9",
        index:       i,
        timestamp:   row?.timestamp,
        symbol,
        side:        match.side,
        signalType,
        score,
        intradayLevel,
        slopeH4Level,
        slopeH4LevelS1,

        slope_h4:    num(row?.slope_h4),
        dslope_h4:   num(row?.dslope_h4),
        drsi_h4:     num(row?.drsi_h4),
        rsi_h4_s0:   num(row?.rsi_h4_s0),
        slope_h4_s0: num(row?.slope_h4_s0),
        drsi_h4_s0:  num(row?.drsi_h4_s0),

        rsi_h1:      num(row?.rsi_h1),
        slope_h1:    num(row?.slope_h1),
        dslope_h1:   num(row?.dslope_h1),
        drsi_h1:     num(row?.drsi_h1),
        zscore_h1:   num(row?.zscore_h1),
        dz_h1:       num(row?.dz_h1),
        atr_h1:      num(row?.atr_h1),

        rsi_h1_s0:    num(row?.rsi_h1_s0),
        slope_h1_s0:  num(row?.slope_h1_s0),
        drsi_h1_s0:   num(row?.drsi_h1_s0),
        zscore_h1_s0: num(row?.zscore_h1_s0),

        atr_m15:    num(row?.atr_m15),
        rsi_m15:    num(row?.rsi_m15),
        slope_m15:  num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

        rsi_m5:    num(row?.rsi_m5),
        slope_m5:  num(row?.slope_m5),
        dslope_m5: num(row?.dslope_m5),
        drsi_m5:   num(row?.drsi_m5),
        zscore_m5: num(row?.zscore_m5),

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

    // ============================================================================
    // DEBUG PIPELINE
    // ============================================================================
    if (TOP_CFG.debug) {
      let cTotal = 0, cAtr = 0, cAntiSpike = 0, cResolve = 0, cZscore = 0, cDrsiGate = 0, cRevKill = 0, cRoute = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        cTotal++;

        const atrH1 = num(row?.atr_h1);
        if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 2 * atrH1Cap) continue;
        cAtr++;

        const drsi_h1    = num(row?.drsi_h1);
        const drsi_h1_s0 = num(row?.drsi_h1_s0);
        if (drsi_h1    !== null && Math.abs(drsi_h1)    >= 8)             continue;
        if (drsi_h1_s0 !== null && Math.abs(drsi_h1_s0) >= antiSpikeH1S0) continue;
        cAntiSpike++;

        const intra         = num(row?.intraday_change);
        const intradayLevel = getIntradayLevel(intra, intCfg);

        const slope_h4_s1_v = num(row?.slope_h4);
        const slope_h4_s0_v = num(row?.slope_h4_s0);
        const slope_h4_raw  = slope_h4_s0_v !== null ? slope_h4_s0_v : slope_h4_s1_v;
        const slopeH4Level  = getSlopeRegime(slope_h4_raw,    slopeCfg.h4);
        const slopeH4LvlS1  = getSlopeRegime(slope_h4_s1_v,  slopeCfg.h4);
        const dslopeH4Live  = num(row?.dslope_h4);
        const dslopeH1Live  = num(row?.dslope_h1);
        const drsi_h4_s0    = num(row?.drsi_h4_s0);

        const buyRes  = resolve3D(intradayLevel, slopeH4Level, slopeH4LvlS1, drsi_h4_s0, dslopeH4Live, dslopeH1Live, "BUY",  drsiH4Thr);
        const sellRes = resolve3D(intradayLevel, slopeH4Level, slopeH4LvlS1, drsi_h4_s0, dslopeH4Live, dslopeH1Live, "SELL", drsiH4Thr);
        if (!buyRes && !sellRes) continue;
        cResolve++;

        const zscore_h4    = num(row?.zscore_h4_s0) ?? num(row?.zscore_h4);
        const zscore_h1    = num(row?.zscore_h1_s0) ?? num(row?.zscore_h1);
        const zscore_h1_s1 = num(row?.zscore_h1);
        const dz_h1_live   = (zscore_h1 !== null && zscore_h1_s1 !== null) ? zscore_h1 - zscore_h1_s1 : null;

        const activeRes  = buyRes ?? sellRes;
        const activeSide = buyRes ? "BUY" : "SELL";
        const activeMode = activeRes.mode ?? computeMode(activeRes.type, activeSide, intradayLevel, slopeH4Level, drsi_h4_s0, drsiH4Thr);

        if (!passZscoreGate({ side: activeSide, type: activeRes.type, mode: activeMode, zscore: zscore_h1, dz: dz_h1_live, zscoreH4: zscore_h4 })) {
          if (i < 50) console.log(`[zscore FAIL] mode=${activeMode} type=${activeRes.type} side=${activeSide} | zh1=${zscore_h1?.toFixed(2)} zh4=${zscore_h4?.toFixed(2)} dz=${dz_h1_live?.toFixed(2)}`);
          continue;
        }
        cZscore++;

        if (activeMode !== "spike" && !drsiContextGate(activeSide, activeRes.type, intradayLevel, drsi_h1_s0, drsi_h4_s0, symbol)) continue;
        cDrsiGate++;

        if (activeRes.type === "REVERSAL" && riskCfg.reversalEnabled === false) continue;
        cRevKill++;

        const rsi_h1_s0_d    = num(row?.rsi_h1_s0) ?? num(row?.rsi_h1);
        const slope_h1_s0_v  = num(row?.slope_h1_s0);
        const slope_h1_s1_v  = num(row?.slope_h1);
        const dslope_h1_live = (slope_h1_s0_v !== null && slope_h1_s1_v !== null) ? slope_h1_s0_v - slope_h1_s1_v : null;

        const routeMatch = activeSide === "BUY"
          ? matchBuyRoute(rsi_h1_s0_d, drsi_h1_s0, dslope_h1_live, activeRes.type)
          : matchSellRoute(rsi_h1_s0_d, drsi_h1_s0, dslope_h1_live, activeRes.type);

        if (!routeMatch) {
          if (i < 50) console.log(`[route FAIL] mode=${activeMode} type=${activeRes.type} side=${activeSide} | rsi=${rsi_h1_s0_d?.toFixed(1)} drsi=${drsi_h1_s0?.toFixed(2)} dslope_h1=${dslope_h1_live?.toFixed(2)}`);
          continue;
        }
        cRoute++;
      }

      console.info("TOPOPP V9", { total_rows: rows.length, signals: opps.length });
      console.table({
        "0 — total rows":      { count: cTotal,    pct: "100%" },
        "1 — after ATR":       { count: cAtr,       pct: ((cAtr/cTotal)*100).toFixed(1)+"%" },
        "2 — after antiSpike": { count: cAntiSpike, pct: ((cAntiSpike/cAtr)*100).toFixed(1)+"%" },
        "3 — after resolve3D": { count: cResolve,   pct: ((cResolve/cAntiSpike)*100).toFixed(1)+"%" },
        "4 — after zscore":    { count: cZscore,    pct: ((cZscore/cResolve)*100).toFixed(1)+"%" },
        "5 — after drsiGate":  { count: cDrsiGate,  pct: ((cDrsiGate/cZscore)*100).toFixed(1)+"%" },
        "6 — after revKill":   { count: cRevKill,   pct: ((cRevKill/cDrsiGate)*100).toFixed(1)+"%" },
        "7 — after route":     { count: cRoute,     pct: ((cRoute/cRevKill)*100).toFixed(1)+"%" },
      });
    }

    return opps;
  }

  return { evaluate };
})();

export default TopOpportunities_V9;