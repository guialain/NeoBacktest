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
  // 3D RESOLUTION : intradayLevel x slopeH4Level x drsiH4S0 => { type, mode }
  // ============================================================================
  function resolve3D(intradayLevel, slopeH4Level, drsiH4S0, side, thr = 0.3) {
    const h4Up =
      slopeH4Level === "SOFT_UP" ||
      slopeH4Level === "STRONG_UP" ||
      slopeH4Level === "EXPLOSIVE_UP";

    const h4Down =
      slopeH4Level === "SOFT_DOWN" ||
      slopeH4Level === "STRONG_DOWN" ||
      slopeH4Level === "EXPLOSIVE_DOWN";

    const dh4Up = drsiH4S0 !== null && drsiH4S0 >= thr;
    const dh4Down = drsiH4S0 !== null && drsiH4S0 <= -thr;
    const dh4OkBuy = dh4Up || (!dh4Up && !dh4Down);
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
        const h4Hostile = slopeH4Level === "SPIKE_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN";
        return dh4Up && !h4Hostile ? { type: "EARLY" } : null;
      }
      if (intradayLevel === "SPIKE_DOWN")
        return h4Up && dh4OkBuy ? { type: "REVERSAL", mode: "spike" } : null;
      if (intradayLevel === "SPIKE_UP") return null;
      if (!h4Up) return null;
      if (isUpIC) return dh4OkBuy ? { type: "CONTINUATION" } : null;
      if (isDownIC) return dh4OkBuy ? { type: "REVERSAL" } : null;
      return null;
    }

    if (side === "SELL") {
      if (intradayLevel === "NEUTRE") {
        const h4Hostile = slopeH4Level === "SPIKE_UP" || slopeH4Level === "EXPLOSIVE_UP";
        return dh4Down && !h4Hostile ? { type: "EARLY" } : null;
      }
      if (intradayLevel === "SPIKE_UP")
        return h4Down && dh4OkSell ? { type: "REVERSAL", mode: "spike" } : null;
      if (intradayLevel === "SPIKE_DOWN") return null;
      if (!h4Down) return null;
      if (isDownIC) return dh4OkSell ? { type: "CONTINUATION" } : null;
      if (isUpIC) return dh4OkSell ? { type: "REVERSAL" } : null;
      return null;
    }

    return null;
  }

  // ============================================================================
  // MODE — qualité du setup
  // ============================================================================
  const STRONG_UP_LEVELS = ["STRONG_UP", "EXPLOSIVE_UP", "SPIKE_UP"];
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
        ? slopeH4Level === "STRONG_UP" || slopeH4Level === "EXPLOSIVE_UP"
        : slopeH4Level === "STRONG_DOWN" || slopeH4Level === "EXPLOSIVE_DOWN";

    const conf = [icStrong, h4Strong, dh4Confirm].filter(Boolean).length;

    if (conf === 3) return "relaxed";
    if (conf === 2) return "soft";
    if (conf >= 1) return "normal";
    return "strict";
  }

  // ============================================================================
  // ZSCORE THRESHOLDS — bloc unique
  // ============================================================================
  function getZscoreThresholds(mode) {
    const CONT = {
      strict: 1.0,
      normal: 1.5,
      soft: 2.0,
      relaxed: 2.3,
      spike: 99,
    };

    const REV = {
      strict: 1.5,
      normal: 1.2,
      soft: 1.0,
      relaxed: 0.8,
      spike: 0.5,
    };

    const EARLY = {
      strict: 0.8,
      normal: 1.0,
      soft: 1.2,
      relaxed: 1.5,
      spike: 1.5,
    };

    return {
      cont: CONT[mode] ?? 1.5,
      rev: REV[mode] ?? 1.2,
      early: EARLY[mode] ?? 1.0,
    };
  }

  function passZscoreGate({ side, type, mode, zscore }) {
    if (zscore === null) return false;
    if (Math.abs(zscore) > 3) return false;

    const { cont, rev, early } = getZscoreThresholds(mode);

    if (type === "CONTINUATION") {
      if (side === "BUY") return zscore < cont;
      if (side === "SELL") return zscore > -cont;
    }

    if (type === "REVERSAL") {
      if (side === "BUY") return zscore < -rev;
      if (side === "SELL") return zscore > rev;
    }

    if (type === "EARLY") {
      if (side === "BUY") return zscore < early;
      if (side === "SELL") return zscore > -early;
    }

    return false;
  }

  // ============================================================================
  // DRSI CONTEXT GATE
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
        SOFT_UP: [-0.20, -0.10],
        STRONG_UP: [-0.50, -0.30],
        EXPLOSIVE_UP: [-1.00, -0.50],
        NEUTRE: [-0.40, 0],
        SOFT_DOWN: [-0.35, 0],
        STRONG_DOWN: [-0.25, 0],
        EXPLOSIVE_DOWN: [-0.20, 0],
      };
      const [h1Min, h4Min] = SELL_FLOOR[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 > h1Min) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 > h4Min) return false;
    } else {
      const BUY_CEIL = {
        SOFT_DOWN: [0.20, 0.10],
        STRONG_DOWN: [0.50, 0.30],
        EXPLOSIVE_DOWN: [1.00, 0.50],
        NEUTRE: [0.40, 0],
        SOFT_UP: [0.35, 0],
        STRONG_UP: [0.25, 0],
        EXPLOSIVE_UP: [0.20, 0],
      };
      const [h1Max, h4Max] = BUY_CEIL[intradayLevel] ?? [0, 0];
      if (drsi_h1_s0 !== null && drsi_h1_s0 < h1Max) return false;
      if (drsi_h4_s0 !== null && drsi_h4_s0 < h4Max) return false;
    }

    return true;
  }

  // ============================================================================
  // RSI + DRSI TIMING
  // ============================================================================
  function matchBuyRoute(rsi_h1_s0, drsi_h1_s0, type) {
    if (rsi_h1_s0 === null || drsi_h1_s0 === null) return null;

    if (type === "CONTINUATION") {
      if (rsi_h1_s0 >= 28 && rsi_h1_s0 < 50 && drsi_h1_s0 > 0.3) {
        return { route: "BUY-[28-50]", side: "BUY" };
      }
      if (rsi_h1_s0 >= 50 && rsi_h1_s0 < 72 && drsi_h1_s0 > 0.3) {
        return { route: "BUY-[50-72]", side: "BUY" };
      }
      return null;
    }

    if (type === "REVERSAL") {
      if (rsi_h1_s0 < 35 && drsi_h1_s0 > 0) {
        return { route: "BUY-REV-[0-35]", side: "BUY" };
      }
      return null;
    }

    if (type === "EARLY") {
      if (rsi_h1_s0 >= 35 && rsi_h1_s0 < 60 && drsi_h1_s0 > 0.2) {
        return { route: "BUY-EARLY-[35-60]", side: "BUY" };
      }
      return null;
    }

    return null;
  }

  function matchSellRoute(rsi_h1_s0, drsi_h1_s0, type) {
    if (rsi_h1_s0 === null || drsi_h1_s0 === null) return null;

    if (type === "CONTINUATION") {
      if (rsi_h1_s0 >= 50 && rsi_h1_s0 < 72 && drsi_h1_s0 < -0.3) {
        return { route: "SELL-[50-72]", side: "SELL" };
      }
      if (rsi_h1_s0 >= 28 && rsi_h1_s0 < 50 && drsi_h1_s0 < -0.3) {
        return { route: "SELL-[28-50]", side: "SELL" };
      }
      return null;
    }

    if (type === "REVERSAL") {
      if (rsi_h1_s0 > 65 && drsi_h1_s0 < 0) {
        return { route: "SELL-REV-[65-100]", side: "SELL" };
      }
      return null;
    }

    if (type === "EARLY") {
      if (rsi_h1_s0 > 40 && rsi_h1_s0 <= 65 && drsi_h1_s0 < -0.2) {
        return { route: "SELL-EARLY-[40-65]", side: "SELL" };
      }
      return null;
    }

    return null;
  }

  const ROUTE_PHASE = {
    "BUY-[28-50]": "LOW_MID",
    "BUY-[50-72]": "MID_HIGH",
    "BUY-REV-[0-35]": "REV_LOW",
    "BUY-EARLY-[35-60]": "EARLY_LOW",
    "SELL-[50-72]": "MID_HIGH",
    "SELL-[28-50]": "LOW_MID",
    "SELL-REV-[65-100]": "REV_HIGH",
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

    const a = toDate(tsA);
    const b = toDate(tsB);
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
    const maxSignals = num(cfg?.maxSignals) ?? Infinity;

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

    const riskCfg = getRiskConfig(symbol);
    const intCfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
    const slopeCfg = getSlopeConfig(symbol);

    const TOP_CFG = {
      minSignalSpacingMinutes: num(opts?.minSignalSpacingMinutes) ?? 0,
      maxSignals: num(opts?.maxSignals) ?? Infinity,
      scoreMin: num(opts?.scoreMin) ?? 0,
      debug: Boolean(opts?.debug),
    };

    const drsiH4Thr = slopeCfg.dslopeH4Thr ?? 0.3;
    const antiSpikeH1S0 = num(slopeCfg?.antiSpikeH1S0) ?? 8;
    const atrH1Cap = num(riskCfg?.atrH1Cap);

    let opps = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const atrH1 = num(row?.atr_h1);
      if (atrH1Cap > 0 && atrH1 !== null && atrH1 > 2 * atrH1Cap) continue;

      const drsi_h1 = num(row?.drsi_h1);
      const drsi_h1_s0 = num(row?.drsi_h1_s0);
      const drsi_h4_s0 = num(row?.drsi_h4_s0);

      if (drsi_h1 !== null && Math.abs(drsi_h1) >= 8) continue;
      if (drsi_h1_s0 !== null && Math.abs(drsi_h1_s0) >= antiSpikeH1S0) continue;

      const intra = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      const slope_h4_raw =
        num(row?.slope_h4_s0) !== null ? num(row?.slope_h4_s0) : num(row?.slope_h4);

      const slopeH4Level = getSlopeRegime(slope_h4_raw, slopeCfg.h4);

      let match = null;
      let signalType = null;
      let signalMode = null;

      const zscore_h1 = num(row?.zscore_h1_s0) ?? num(row?.zscore_h1);
      const rsi_h1_s0 = num(row?.rsi_h1_s0) ?? num(row?.rsi_h1);

      const buyRes = resolve3D(intradayLevel, slopeH4Level, drsi_h4_s0, "BUY", drsiH4Thr);
      if (buyRes) {
        const buyMode =
          buyRes.mode ??
          computeMode(
            buyRes.type,
            "BUY",
            intradayLevel,
            slopeH4Level,
            drsi_h4_s0,
            drsiH4Thr
          );

        if (
          passZscoreGate({
            side: "BUY",
            type: buyRes.type,
            mode: buyMode,
            zscore: zscore_h1,
          })
        ) {
          match = matchBuyRoute(rsi_h1_s0, drsi_h1_s0, buyRes.type);
          if (match) {
            signalType = buyRes.type;
            signalMode = buyMode;
          }
        }
      }

      if (!match) {
        const sellRes = resolve3D(intradayLevel, slopeH4Level, drsi_h4_s0, "SELL", drsiH4Thr);
        if (sellRes) {
          const sellMode =
            sellRes.mode ??
            computeMode(
              sellRes.type,
              "SELL",
              intradayLevel,
              slopeH4Level,
              drsi_h4_s0,
              drsiH4Thr
            );

          if (
            passZscoreGate({
              side: "SELL",
              type: sellRes.type,
              mode: sellMode,
              zscore: zscore_h1,
            })
          ) {
            match = matchSellRoute(rsi_h1_s0, drsi_h1_s0, sellRes.type);
            if (match) {
              signalType = sellRes.type;
              signalMode = sellMode;
            }
          }
        }
      }

      if (!match) continue;

      if (
        signalMode !== "spike" &&
        !drsiContextGate(match.side, signalType, intradayLevel, drsi_h1_s0, drsi_h4_s0, symbol)
      ) {
        continue;
      }

      if (signalType === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      const score =
        signalType === "REVERSAL"
          ? 80
          : signalType === "EARLY"
            ? 70
            : Math.max(
                0,
                Math.round(
                  Math.abs(num(row?.slope_h1) ?? 0) * 50 +
                    Math.abs((num(row?.rsi_h1) ?? 50) - 50) * 2
                )
              );

      if (score < TOP_CFG.scoreMin) continue;

      opps.push({
        type: signalType,
        mode: signalMode,
        regime: `${signalType}_${match.side}`,
        route: match.route,
        signalPhase: ROUTE_PHASE[match.route] ?? match.route,
        engine: "V9",
        index: i,
        timestamp: row?.timestamp,
        symbol,
        side: match.side,
        signalType,
        score,
        intradayLevel,
        slopeH4Level,

        slope_h4: num(row?.slope_h4),
        dslope_h4: num(row?.dslope_h4),
        drsi_h4: num(row?.drsi_h4),
        rsi_h4_s0: num(row?.rsi_h4_s0),
        slope_h4_s0: num(row?.slope_h4_s0),
        drsi_h4_s0: num(row?.drsi_h4_s0),

        rsi_h1: num(row?.rsi_h1),
        slope_h1: num(row?.slope_h1),
        dslope_h1: num(row?.dslope_h1),
        drsi_h1: num(row?.drsi_h1),
        zscore_h1: num(row?.zscore_h1),
        dz_h1: num(row?.dz_h1),
        atr_h1: num(row?.atr_h1),

        rsi_h1_s0: num(row?.rsi_h1_s0),
        slope_h1_s0: num(row?.slope_h1_s0),
        drsi_h1_s0: num(row?.drsi_h1_s0),
        zscore_h1_s0: num(row?.zscore_h1_s0),

        atr_m15: num(row?.atr_m15),
        rsi_m15: num(row?.rsi_m15),
        slope_m15: num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

        rsi_m5: num(row?.rsi_m5),
        slope_m5: num(row?.slope_m5),
        dslope_m5: num(row?.dslope_m5),
        drsi_m5: num(row?.drsi_m5),
        zscore_m5: num(row?.zscore_m5),

        rsi_m5_s0: num(row?.rsi_m5_s0),
        slope_m5_s0: num(row?.slope_m5_s0),
        drsi_m5_s0: num(row?.drsi_m5_s0),
        zscore_m5_s0: num(row?.zscore_m5_s0),

        close: num(row?.close),
        intraday_change: intra,
      });
    }

    opps.sort((a, b) => {
      const sa = a.score ?? 0;
      const sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return String(b.timestamp ?? "").localeCompare(String(a.timestamp ?? ""));
    });

    opps = applyDedupeAndSpacing(opps, TOP_CFG);

    if (TOP_CFG.debug) {
      console.info("TOPOPP V9", { total_rows: rows.length, signals: opps.length });
    }

    return opps;
  }

  return { evaluate };
})();

export default TopOpportunities_V9;