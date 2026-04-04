// ============================================================================
// TopOpportunities_H1.js — H1 ROUTER v4 — Intraday-Driven Type System
//
// 10 routes RSI (5 BUY + 5 SELL miroir) :
//   BUY  [0-25] [25-30] [30-50] [50-70] [70-75]
//   SELL [75-100] [70-75] [50-70] [30-50] [25-30]
//
// Type REVERSAL/CONTINUATION déterminé par contexte intraday :
//   trade contre le jour = REVERSAL, dans le sens du jour = CONTINUATION
//
//   Intraday         BUY                  SELL
//   EXPLOSIVE_DOWN   REVERSAL assoupli    ❌ bloqué
//   STRONG_DOWN      ❌ bloqué            CONTINUATION assoupli
//   DOWN             REVERSAL strict      CONTINUATION
//   NEUTRE           standard             standard
//   UP               CONTINUATION         REVERSAL strict
//   STRONG_UP        CONTINUATION assp    ❌ bloqué
//   EXPLOSIVE_UP     ❌ bloqué            REVERSAL assoupli
//
// Gates assouplis :
//   R assoupli : slope_h4 élargi (>-5 / <6), bypass drsi_h1_s0
//   C assoupli : zscore élargi (2.5 / -2.5), bypass h1SlopeAccel/Decel
//   drsiH4 gate : toujours obligatoire (jamais bypassé)
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";
import { INTRADAY_CONFIG } from "../config/IntradayConfig.js";

const TopOpportunities_H1 = (() => {

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // ============================================================================
  // NIVEAU 1 — INTRADAY LEVEL + TYPE RESOLUTION
  // ============================================================================
  function getIntradayLevel(intra, cfg) {
    if (intra === null) return "NEUTRE";
    if (intra >= cfg.explosiveUp)  return "EXPLOSIVE_UP";
    if (intra >= cfg.strongUp)     return "STRONG_UP";
    if (intra >= cfg.dailyUp)      return "UP";
    if (intra > cfg.dailyDown)     return "NEUTRE";
    if (intra > cfg.strongDown)    return "DOWN";
    if (intra > cfg.explosiveDown) return "STRONG_DOWN";
    return "EXPLOSIVE_DOWN";
  }

  // Returns { type, mode } or null if blocked
  const INTRADAY_TABLE = {
    EXPLOSIVE_DOWN: { BUY: { type: "REVERSAL",      mode: "relaxed" }, SELL: null },
    STRONG_DOWN:    { BUY: { type: "REVERSAL",      mode: "normal"  }, SELL: { type: "CONTINUATION", mode: "relaxed" } },
    DOWN:           { BUY: { type: "REVERSAL",      mode: "normal"  }, SELL: { type: "CONTINUATION", mode: "normal"  } },
    NEUTRE:         { BUY: { type: "STANDARD",      mode: "normal"  }, SELL: { type: "STANDARD",     mode: "normal"  } },
    UP:             { BUY: { type: "CONTINUATION",  mode: "normal"  }, SELL: { type: "REVERSAL",     mode: "normal"  } },
    STRONG_UP:      { BUY: { type: "CONTINUATION",  mode: "relaxed" }, SELL: { type: "REVERSAL",     mode: "normal"  } },
    EXPLOSIVE_UP:   { BUY: null,                                        SELL: { type: "REVERSAL",     mode: "relaxed" } },
  };

  function resolveType(level, side) {
    return INTRADAY_TABLE[level]?.[side] ?? null;
  }

  // ============================================================================
  // GATE PRESETS
  // ============================================================================
  function buildGates(side, mode, type) {
    const isRev = (type === "REVERSAL");
    const g = {
      // H4 gates (routes [0-25] [25-30] / [75-100] [70-75])
      slopeH4Min: -3,    slopeH4Max: 3,
      // drsi_h1_s0 gate (low/high RSI routes)
      drsiH1S0Required: true,
      // Continuation gates (routes [30-50] [50-70] [70-75] / miroir)
      zscoreMax: 1.9,    zscoreMin: -1.8,
      h1AccelRequired: !isRev,  h1DecelRequired: !isRev,
      // Slope eff threshold for [30-50] — relaxed for reversal
      slopeEffMin: isRev ? -0.5 : 0.3,
    };

    if (mode === "relaxed") {
      if (side === "BUY") {
        // EXPLOSIVE_DOWN → R-BUY assoupli : slope_h4 élargi, bypass drsi_h1_s0
        // STRONG_UP → C-BUY assoupli : zscore élargi, bypass h1SlopeAccel
        g.slopeH4Min = -5;
        g.drsiH1S0Required = false;
        g.zscoreMax = 2.5;
        g.h1AccelRequired = false;
      } else {
        // EXPLOSIVE_UP → R-SELL assoupli : slope_h4 élargi, bypass drsi_h1_s0
        // STRONG_DOWN → C-SELL assoupli : zscore élargi, bypass h1SlopeDecel
        g.slopeH4Max = 6;
        g.drsiH1S0Required = false;
        g.zscoreMin = -2.5;
        g.h1DecelRequired = false;
      }
    }
    return g;
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
  // NIVEAU 2 — BUY ROUTES
  // ============================================================================
  function matchBuyRoute(
    rsi_s1, slope_h1, dslope_h1, drsi_h1, zscore_h1,
    prevLow3, prevHigh3, zscore_h1_min3, zscore_h1_max3,
    slope_h1_s0, drsi_h1_s0, zscore_h1_s0,
    drsi_h4, drsi_h4_s0, slope_h4, slope_h4_s0,
    rsi_h1_s0,
    g
  ) {
    // RSI effectif = s0 prioritaire, fallback s1
    const rsi = rsi_h1_s0 !== null ? rsi_h1_s0 : rsi_s1;
    if (rsi === null || dslope_h1 === null || zscore_h1 === null) return null;

    // ── Derived indicators ───────────────────────────────────────────────
    // slope H1 effectif = s0 prioritaire, fallback s1
    const slope_eff = slope_h1_s0 !== null ? slope_h1_s0 : slope_h1;
    const zscore    = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
    // drsi H1 = delta RSI s0 - s1 (momentum live), fallback drsi_h1 CSV
    const drsi_h1_live = (rsi_h1_s0 !== null && rsi_s1 !== null)
      ? rsi_h1_s0 - rsi_s1 : drsi_h1;

    // dslope H1 = delta slope s0 - s1
    const dslope_h1_live = (slope_h1_s0 !== null && slope_h1 !== null)
      ? slope_h1_s0 - slope_h1 : null;
    const h1SlopeAccel = g.h1AccelRequired
      ? (dslope_h1_live === null || dslope_h1_live > 0.1)
      : true;

    // H4 effectif = s0 prioritaire, fallback s1
    const slope_h4_eff = slope_h4_s0 !== null ? slope_h4_s0 : slope_h4;
    const dslope_h4_live = (slope_h4_s0 !== null && slope_h4 !== null)
      ? slope_h4_s0 - slope_h4 : null;
    const h4SlopeAccel = (dslope_h4_live === null || dslope_h4_live > 0.25)
      && (slope_h4_eff === null || slope_h4_eff > -5.0);

    const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
    const h4BuyOk = drsi_h4_eff === null || drsi_h4_eff >= -0.3;

    // H4 gates modulés (routes [0-25] [25-30])
    const slopeH4Ok = slope_h4_eff !== null && slope_h4_eff > g.slopeH4Min;
    const drsiH4Ok  = drsi_h4_s0 !== null && drsi_h4_s0 > 0; // toujours obligatoire

    // drsi H1 gate — bypassé en mode assoupli (EXPLOSIVE_DOWN)
    const drsiH1_0   = !g.drsiH1S0Required || (drsi_h1_live !== null && drsi_h1_live > 0);
    const drsiH1_05  = !g.drsiH1S0Required || (drsi_h1_live !== null && drsi_h1_live > 0.5);

    const drsiSafe = drsi_h1_live === null || Math.abs(drsi_h1_live) < 6;

    // ── BUY [0-25] — extreme oversold ────────────────────────────────────
    if (rsi < 25
     && drsiH1_0
     && slopeH4Ok && drsiH4Ok
     && dslope_h1 > 0.25
     && zscore < -0.3)
      return { route: "BUY-[0-25]", side: "BUY" };

    // ── BUY [25-30] — oversold ───────────────────────────────────────────
    if (rsi >= 25 && rsi < 30
     && drsiH1_05
     && slopeH4Ok && drsiH4Ok
     && dslope_h1 > 0.25
     && zscore < -0.3)
      return { route: "BUY-[25-30]", side: "BUY" };

    // ── BUY [30-50] — low-mid zone ──────────────────────────────────────
    if (rsi >= 30 && rsi < 50
     && slope_eff !== null && slope_eff > g.slopeEffMin
     && h1SlopeAccel
     && h4SlopeAccel
     && zscore > -2.0 && zscore < g.zscoreMax
     && (g.h1AccelRequired ? dslope_h1 > 0.1 : true)
     && drsiSafe && h4BuyOk)
      return { route: "BUY-[30-50]", side: "BUY" };

    // ── BUY [50-70] — mid-high zone ─────────────────────────────────────
    if (rsi >= 50 && rsi < 70
     && slope_eff !== null && slope_eff > 0.3
     && h1SlopeAccel
     && h4SlopeAccel
     && zscore > -1.0 && zscore < 1.8
     && drsiSafe && h4BuyOk)
      return { route: "BUY-[50-70]", side: "BUY" };

    // ── BUY [70-75] — high zone ─────────────────────────────────────────
    if (rsi >= 70 && rsi < 72
     && slope_eff !== null && slope_eff > 1.0
     && h1SlopeAccel
     && h4SlopeAccel
     && zscore > 0.3 && zscore < g.zscoreMax
     && drsiSafe && h4BuyOk)
      return { route: "BUY-[70-75]", side: "BUY" };

    return null;
  }

  // ============================================================================
  // SELL ROUTES (miroir)
  // ============================================================================
  function matchSellRoute(
    rsi_s1, slope_h1, dslope_h1, drsi_h1, zscore_h1,
    prevLow3, prevHigh3, zscore_h1_min3, zscore_h1_max3,
    slope_h1_s0, drsi_h1_s0, zscore_h1_s0,
    drsi_h4, drsi_h4_s0, slope_h4, slope_h4_s0,
    rsi_h1_s0,
    g
  ) {
    // RSI effectif = s0 prioritaire, fallback s1
    const rsi = rsi_h1_s0 !== null ? rsi_h1_s0 : rsi_s1;
    if (rsi === null || dslope_h1 === null || zscore_h1 === null) return null;

    // ── Derived indicators ───────────────────────────────────────────────
    // slope H1 effectif = s0 prioritaire, fallback s1
    const slope_eff = slope_h1_s0 !== null ? slope_h1_s0 : slope_h1;
    const zscore    = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;
    // drsi H1 = delta RSI s0 - s1 (momentum live), fallback drsi_h1 CSV
    const drsi_h1_live = (rsi_h1_s0 !== null && rsi_s1 !== null)
      ? rsi_h1_s0 - rsi_s1 : drsi_h1;

    // dslope H1 = delta slope s0 - s1
    const dslope_h1_live = (slope_h1_s0 !== null && slope_h1 !== null)
      ? slope_h1_s0 - slope_h1 : null;
    const h1SlopeDecel = g.h1DecelRequired
      ? (dslope_h1_live === null || dslope_h1_live < -0.1)
      : true;

    // H4 effectif = s0 prioritaire, fallback s1
    const slope_h4_eff = slope_h4_s0 !== null ? slope_h4_s0 : slope_h4;
    const dslope_h4_live = (slope_h4_s0 !== null && slope_h4 !== null)
      ? slope_h4_s0 - slope_h4 : null;
    const h4SlopeDecel = (dslope_h4_live === null || dslope_h4_live < -1.0)
      && (slope_h4_eff === null || slope_h4_eff < 5.0);

    const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
    const h4SellOk = drsi_h4_eff === null || drsi_h4_eff <= 0.3;

    // H4 gates modulés (routes [75-100] [70-75])
    const slopeH4Ok = slope_h4_eff !== null && slope_h4_eff < g.slopeH4Max;
    const drsiH4Ok  = drsi_h4_s0 !== null && drsi_h4_s0 < 0; // toujours obligatoire

    // drsi H1 gate — bypassé en mode assoupli (EXPLOSIVE_UP)
    const drsiH1_0   = !g.drsiH1S0Required || (drsi_h1_live !== null && drsi_h1_live < 0);
    const drsiH1_05  = !g.drsiH1S0Required || (drsi_h1_live !== null && drsi_h1_live < -0.5);

    const drsiSafe = drsi_h1_live === null || Math.abs(drsi_h1_live) < 6;

    // ── SELL [75-100] — extreme overbought ──────────────────────────────
    if (rsi >= 75
     && drsiH1_0
     && slopeH4Ok && drsiH4Ok
     && dslope_h1 < -0.25
     && zscore > 0.3)
      return { route: "SELL-[75-100]", side: "SELL" };

    // ── SELL [70-75] — overbought ───────────────────────────────────────
    if (rsi >= 70 && rsi < 75
     && drsiH1_05
     && slopeH4Ok && drsiH4Ok
     && dslope_h1 < -0.25
     && zscore > 0.3)
      return { route: "SELL-[70-75]", side: "SELL" };

    // ── SELL [50-70] — mid-high zone ────────────────────────────────────
    if (rsi >= 50 && rsi < 70
     && slope_eff !== null && slope_eff < -0.3
     && h1SlopeDecel
     && h4SlopeDecel
     && zscore < 1.0 && zscore > g.zscoreMin
     && drsiSafe && h4SellOk)
      return { route: "SELL-[50-70]", side: "SELL" };

    // ── SELL [30-50] — low-mid zone ─────────────────────────────────────
    if (rsi >= 30 && rsi < 50
     && slope_eff !== null && slope_eff < -g.slopeEffMin
     && h1SlopeDecel
     && h4SlopeDecel
     && zscore < 2.0 && zscore > -2.5
     && (g.h1DecelRequired ? dslope_h1 < -0.1 : true)
     && drsiSafe && h4SellOk)
      return { route: "SELL-[30-50]", side: "SELL" };

    // ── SELL [25-30] — low zone ─────────────────────────────────────────
    if (rsi >= 28 && rsi < 30
     && slope_eff !== null && slope_eff < -1.0
     && h1SlopeDecel
     && h4SlopeDecel
     && zscore > g.zscoreMin
     && drsiSafe && h4SellOk)
      return { route: "SELL-[25-30]", side: "SELL" };

    return null;
  }

  // =========================
  // ROUTE → SIGNAL PHASE
  // =========================
  const ROUTE_PHASE = {
    "BUY-[0-25]":     "EXTREME_LOW",
    "BUY-[25-30]":    "OVERSOLD",
    "BUY-[30-50]":    "LOW_MID",
    "BUY-[50-70]":    "MID_HIGH",
    "BUY-[70-75]":    "HIGH",
    "SELL-[75-100]":  "EXTREME_HIGH",
    "SELL-[70-75]":   "OVERBOUGHT",
    "SELL-[50-70]":   "MID_HIGH",
    "SELL-[30-50]":   "LOW_MID",
    "SELL-[25-30]":   "LOW",
  };

  // =========================
  // MAIN
  // =========================
  function evaluate(marketData = [], opts = {}) {
    const rows = Array.isArray(marketData) ? marketData : [];
    if (!rows.length) return [];

    const symbol = rows[0]?.symbol;
    if (!symbol) return [];

    const riskCfg = getRiskConfig(symbol);
    const intCfg  = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
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

      // ── Niveau 1 : contexte intraday ────────────────────────────────
      const intra = num(row?.intraday_change);
      const intradayLevel = getIntradayLevel(intra, intCfg);

      // ── Indicateurs communs ─────────────────────────────────────────
      const args = [
        num(row?.rsi_h1), num(row?.slope_h1), num(row?.dslope_h1),
        num(row?.drsi_h1), num(row?.zscore_h1),
        num(row?.rsi_h1_previouslow3), num(row?.rsi_h1_previoushigh3),
        num(row?.zscore_h1_min3), num(row?.zscore_h1_max3),
        num(row?.slope_h1_s0), num(row?.drsi_h1_s0), num(row?.zscore_h1_s0),
        num(row?.drsi_h4), num(row?.drsi_h4_s0),
        num(row?.slope_h4), num(row?.slope_h4_s0),
        num(row?.rsi_h1_s0),
      ];

      // ── Try BUY ─────────────────────────────────────────────────────
      let match = null;
      let signalType = null;
      let signalMode = null;

      const buyRes = resolveType(intradayLevel, "BUY");
      if (buyRes) {
        const gBuy = buildGates("BUY", buyRes.mode, buyRes.type);
        match = matchBuyRoute(...args, gBuy);
        if (match) {
          signalType = buyRes.type;
          signalMode = buyRes.mode;
        }
      }

      // ── Try SELL (si BUY n'a pas matché) ────────────────────────────
      if (!match) {
        const sellRes = resolveType(intradayLevel, "SELL");
        if (sellRes) {
          const gSell = buildGates("SELL", sellRes.mode, sellRes.type);
          match = matchSellRoute(...args, gSell);
          if (match) {
            signalType = sellRes.type;
            signalMode = sellRes.mode;
          }
        }
      }

      if (!match) continue;

      // Computed drsi s0
      const _drsi_h1_s0 = num(row?.drsi_h1_s0);
      const _drsi_h4_s0 = num(row?.drsi_h4_s0);

      // Anti-spike drsi H1 — |drsi_h1| >= 5 OR |drsi_h1_s0| >= 5 = spike, block tout
      const _drsi_h1 = num(row?.drsi_h1);
      if (_drsi_h1 !== null && Math.abs(_drsi_h1) >= 5) continue;
      if (_drsi_h1_s0 !== null && Math.abs(_drsi_h1_s0) >= 5) continue;

      // Gate universel drsi s0 — un seul TF contre la direction = block
      if (match.side === "SELL" && ((_drsi_h1_s0 !== null && _drsi_h1_s0 > 0) || (_drsi_h4_s0 !== null && _drsi_h4_s0 > 0))) continue;
      if (match.side === "BUY"  && ((_drsi_h1_s0 !== null && _drsi_h1_s0 < 0) || (_drsi_h4_s0 !== null && _drsi_h4_s0 < 0))) continue;

      // Gate CONT/STANDARD slope s0 — les deux TF doivent être dans la direction
      // + drsi H4 combiné (s0+s1) > 0.5 pour BUY, < -0.5 pour SELL
      if (signalType === "CONTINUATION" || signalType === "STANDARD") {
        const _sl_h1_s0 = num(row?.slope_h1_s0);
        const _sl_h4_s0 = num(row?.slope_h4_s0);
        if (match.side === "BUY"  && ((_sl_h1_s0 !== null && _sl_h1_s0 <= 0) || (_sl_h4_s0 !== null && _sl_h4_s0 <= 0))) continue;
        if (match.side === "SELL" && ((_sl_h1_s0 !== null && _sl_h1_s0 >= 0) || (_sl_h4_s0 !== null && _sl_h4_s0 >= 0))) continue;
        const _drsiH4sum = (_drsi_h4_s0 ?? 0) + (num(row?.drsi_h4) ?? 0);
        if (match.side === "BUY"  && _drsiH4sum < 0.5) continue;
        if (match.side === "SELL" && _drsiH4sum > -0.5) continue;
      }

      // Gate STANDARD (NEUTRE) — slope combiné s0+s1 >= ±1 sur H1 et H4
      if (signalType === "STANDARD") {
        const _slH1sum = (num(row?.slope_h1_s0) ?? 0) + (num(row?.slope_h1) ?? 0);
        const _slH4sum = (num(row?.slope_h4_s0) ?? 0) + (num(row?.slope_h4) ?? 0);
        if (match.side === "BUY"  && (_slH1sum < 1 || _slH4sum < 1)) continue;
        if (match.side === "SELL" && (_slH1sum > -1 || _slH4sum > -1)) continue;
      }

      // Gate slope H4 combiné — routes [50-70] : s0+s1 doit être dans la direction
      if (match.route === "SELL-[50-70]" || match.route === "BUY-[50-70]") {
        const _slH4sum = (num(row?.slope_h4_s0) ?? 0) + (num(row?.slope_h4) ?? 0);
        if (match.side === "SELL" && _slH4sum >= 0) continue;
        if (match.side === "BUY"  && _slH4sum <= 0) continue;
      }

      // Gate REVERSAL slope H1 combiné — s0+s1 > 1 (BUY) / < -1 (SELL)
      // Pas de gate H4 combiné pour REVERSAL (on trade CONTRE le H4)
      if (signalType === "REVERSAL") {
        const _slH1sum = (num(row?.slope_h1_s0) ?? 0) + (num(row?.slope_h1) ?? 0);
        if (match.side === "BUY"  && _slH1sum < 1) continue;
        if (match.side === "SELL" && _slH1sum > -1) continue;
      }

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
        engine:      "H1",
        index:       i,
        timestamp:   row?.timestamp,
        symbol,
        side:        match.side,
        signalType:  match.side,
        score,
        intradayLevel,

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
        rsi_h1_previouslow3:  num(row?.rsi_h1_previouslow3),
        rsi_h1_previoushigh3: num(row?.rsi_h1_previoushigh3),
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
      console.info("TOPOPP H1 v4 (intraday-driven)", {
        total_rows: rows.length,
        signals:    opps.length,
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_H1;
