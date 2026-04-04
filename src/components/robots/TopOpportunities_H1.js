// ============================================================================
// TopOpportunities_H1.js — H1-ONLY ROUTER (no H4 dependency)
// v2: intégration s0 (bougie en cours) sur H1, H4, M5
//   - matchRoute reçoit slope_h1_s0, drsi_h1_s0, zscore_h1_s0
//   - REVERSAL extrêmes utilisent drsi_h1_s0 pour réactivité
//   - CONTINUATION utilise Math.max(slope_h1, slope_h1_s0) pour capter
//     les moves qui s'accélèrent avant la fermeture H1
//   - H4 context gates: slope_h4, drsi_h4 (s0 prioritaire)
//
// Aligned with Matrix-Revolution TopOpportunities_H1.js
// ============================================================================

import { getRiskConfig } from "../config/RiskConfig.js";
import { INTRADAY_CONFIG } from "../config/IntradayConfig.js";

const TopOpportunities_H1 = (() => {

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

  // ============================================================================
  // 17-ROUTE MATCHER — H1 ONLY + s0 intégré
  // ============================================================================
  function matchRoute(
    rsi, slope_h1, dslope_h1, drsi_h1, zscore_h1,
    prevLow3, prevHigh3, zscore_h1_min3, zscore_h1_max3,
    // s0 — bougie H1 en cours (null si non disponibles)
    slope_h1_s0 = null, drsi_h1_s0 = null, zscore_h1_s0 = null,
    // H4 context
    drsi_h4 = null, drsi_h4_s0 = null,
    slope_h4 = null, slope_h4_s0 = null
  ) {
    if (rsi === null || dslope_h1 === null || zscore_h1 === null)
      return null;

    // H4 slope momentum — (s0 - s1) : accélération / décélération
    const dslope_h4_live = (slope_h4_s0 !== null && slope_h4 !== null)
      ? slope_h4_s0 - slope_h4 : null;
    const h4SlopeAccel = (dslope_h4_live === null || dslope_h4_live > 0.25)
      && (slope_h4 === null || slope_h4 > -5.0);
    const h4SlopeDecel = (dslope_h4_live === null || dslope_h4_live < -1.0)
      && (slope_h4 === null || slope_h4 < 5.0);

    // H4 divergence gate — s0 prioritaire, fallback s1
    const drsi_h4_eff = drsi_h4_s0 !== null ? drsi_h4_s0 : drsi_h4;
    const h4BuyOk  = drsi_h4_eff === null || drsi_h4_eff >= -0.3;
    const h4SellOk = drsi_h4_eff === null || drsi_h4_eff <=  0.3;

    // H1 directional gate — s0 prioritaire, sinon s1
    const drsi_h1_eff = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;
    const h1BuyOk  = drsi_h1_eff === null || drsi_h1_eff > 0.3;
    const h1SellOk = drsi_h1_eff === null || drsi_h1_eff < -0.3;

    // slope effectif = max(s1, s0) pour BUY, min(s1, s0) pour SELL
    const slope_buy  = (slope_h1_s0 !== null)
      ? Math.max(slope_h1 ?? -Infinity, slope_h1_s0)
      : slope_h1;
    const slope_sell = (slope_h1_s0 !== null)
      ? Math.min(slope_h1 ?? Infinity,  slope_h1_s0)
      : slope_h1;

    // H1 slope momentum — (s0 - s1) : accélération / décélération
    const dslope_h1_live = (slope_h1_s0 !== null && slope_h1 !== null)
      ? slope_h1_s0 - slope_h1 : null;
    const h1SlopeAccel = dslope_h1_live === null || dslope_h1_live > 0.1;
    const h1SlopeDecel = dslope_h1_live === null || dslope_h1_live < -0.1;

    // drsi effectif = s0 si disponible (plus réactif), sinon s1
    const drsi_buy  = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;
    const drsi_sell = drsi_h1_s0 !== null ? drsi_h1_s0 : drsi_h1;

    // zscore effectif = s0 si disponible
    const zscore = zscore_h1_s0 !== null ? zscore_h1_s0 : zscore_h1;

    // Anti-spike drsi s0 — bloque CONT si |drsi_h1_s0| >= 6
    const drsiS0Safe = drsi_h1_s0 === null || Math.abs(drsi_h1_s0) < 6;

    // ── REVERSAL BUY (bas) ──────────────────────────────────────────────
    // [0-25] Extreme oversold
    if (rsi < 25
     && drsi_buy !== null && drsi_buy > 0
     && slope_h4 !== null && slope_h4 > -3
     && drsi_h4_s0 !== null && drsi_h4_s0 > 0
     && dslope_h1 > 0.25
     && zscore < -0.3)
      return { route: "BUY-R-[0-25]", side: "BUY", type: "REVERSAL" };

    // [25-30] Oversold
    if (rsi >= 25 && rsi < 30
     && drsi_buy !== null && drsi_buy > 0.5
     && slope_h4 !== null && slope_h4 > -3
     && drsi_h4_s0 !== null && drsi_h4_s0 > 0
     && dslope_h1 > 0.25
     && zscore < -0.3)
      return { route: "BUY-R-[25-30]", side: "BUY", type: "REVERSAL" };

    // [30-35] Reversal confirmed
    if (rsi >= 30 && rsi < 35
     && slope_h1 !== null && slope_h1 > -2
     && drsi_buy !== null && drsi_buy > 1
     && slope_h4 !== null && slope_h4 > -3
     && drsi_h4_s0 !== null && drsi_h4_s0 > 0.5
     && dslope_h1 > 0.25
     && zscore < -0.8
     && prevLow3 !== null && prevLow3 < 30)
      return { route: "BUY-R-[30-35]", side: "BUY", type: "REVERSAL" };

    // ── CONTINUATION [35-50] — BRK only ──────────────────────────────
    if (rsi >= 35 && rsi < 50
     && slope_buy !== null && slope_buy > 0.5
     && h1SlopeAccel
     && h4SlopeAccel
     && zscore > -1.5
     && zscore < 1.9
     && zscore_h1_min3 !== null && zscore_h1_min3 < -0.3
     && prevLow3 !== null && prevLow3 < 45
     && drsiS0Safe && h4BuyOk && h1BuyOk)
      return { route: "BUY-C-[35-50]-BRK", side: "BUY", type: "CONTINUATION" };

    // ── CONTINUATION [50-65] — RET / BRK ──────────────────────────────
    // RET — retracement bounce
    if (rsi >= 50 && rsi < 65
     && slope_h1 !== null && slope_h1 > -0.5
     && dslope_h1_live !== null && dslope_h1_live > 1.5
     && dslope_h4_live !== null && dslope_h4_live > 0.25
     && zscore < 1.9
     && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5
     && prevHigh3 !== null && prevHigh3 > 65
     && drsiS0Safe && h4BuyOk && h1BuyOk)
      return { route: "BUY-C-[50-65]-RET", side: "BUY", type: "CONTINUATION" };

    // BRK — breakout from below
    if (rsi >= 50 && rsi < 65
     && slope_buy !== null && slope_buy > -0.5
     && drsi_h1 !== null && Math.abs(drsi_h1) < 6
     && h1SlopeAccel
     && h4SlopeAccel
     && zscore > 0.3
     && zscore < 1.6
     && zscore_h1_min3 !== null && zscore_h1_min3 < 0.05
     && prevLow3 !== null && prevLow3 < 57
     && drsiS0Safe && h4BuyOk && h1BuyOk)
      return { route: "BUY-C-[50-65]-BRK", side: "BUY", type: "CONTINUATION" };

    // ── CONTINUATION [65-70] — RET / BRK ──────────────────────────────
    // RET
    if (rsi >= 65 && rsi < 70
     && slope_h1 !== null && slope_h1 > -1.0
     && h1SlopeAccel
     && h4SlopeAccel
     && zscore < 1.9
     && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5
     && prevHigh3 !== null && prevHigh3 > 64
     && drsiS0Safe && h4BuyOk && h1BuyOk)
      return { route: "BUY-C-[65-70]-RET", side: "BUY", type: "CONTINUATION" };

    // BRK
    if (rsi >= 65 && rsi < 70
     && slope_buy !== null && slope_buy > 1.0
     && h1SlopeAccel
     && h4SlopeAccel
     && zscore > 0.3
     && zscore < 1.9
     && zscore_h1_min3 !== null && zscore_h1_min3 < 0.5
     && prevLow3 !== null && prevLow3 < 65
     && drsiS0Safe && h4BuyOk && h1BuyOk)
      return { route: "BUY-C-[65-70]-BRK", side: "BUY", type: "CONTINUATION" };

    // ── CONTINUATION SELL [65-50] — RET / BRK ─────────────────────────
    // RET
    if (rsi >= 50 && rsi < 65
     && slope_h1 !== null && slope_h1 < 2.0
     && h1SlopeDecel
     && h4SlopeDecel
     && zscore > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3
     && prevHigh3 !== null && prevHigh3 > 65
     && drsiS0Safe && h4SellOk && h1SellOk)
      return { route: "SELL-C-[65-50]-RET", side: "SELL", type: "CONTINUATION" };

    // BRK
    if (rsi >= 50 && rsi < 65
     && slope_sell !== null && slope_sell < 0.5
     && drsi_h1 !== null && Math.abs(drsi_h1) < 6
     && h1SlopeDecel
     && h4SlopeDecel
     && zscore < -0.3
     && zscore > -1.6
     && zscore_h1_max3 !== null && zscore_h1_max3 < -0.05
     && prevHigh3 !== null && prevHigh3 > 43
     && drsiS0Safe && h4SellOk && h1SellOk)
      return { route: "SELL-C-[65-50]-BRK", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION SELL [50-35] — RET / BRK ─────────────────────────
    // RET
    if (rsi >= 35 && rsi < 50
     && slope_h1 !== null && slope_h1 < 0.5
     && dslope_h1_live !== null && dslope_h1_live < -1.5
     && dslope_h4_live !== null && dslope_h4_live < -0.25
     && zscore > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3
     && prevHigh3 !== null && prevHigh3 > 35
     && drsiS0Safe && h4SellOk && h1SellOk)
      return { route: "SELL-C-[50-35]-RET", side: "SELL", type: "CONTINUATION" };

    // BRK
    if (rsi >= 35 && rsi < 50
     && slope_sell !== null && slope_sell < -0.5
     && h1SlopeDecel
     && h4SlopeDecel
     && zscore < -0.1
     && zscore > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > -0.05
     && prevHigh3 !== null && prevHigh3 > 55
     && drsiS0Safe && h4SellOk && h1SellOk)
      return { route: "SELL-C-[50-35]-BRK", side: "SELL", type: "CONTINUATION" };

    // ── CONTINUATION SELL [35-30] — RET / BRK ─────────────────────────
    // RET
    if (rsi >= 30 && rsi < 35
     && slope_h1 !== null && slope_h1 < 1.0
     && h1SlopeDecel
     && h4SlopeDecel
     && zscore > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 < 0.5
     && prevLow3 !== null && prevLow3 < 30
     && drsiS0Safe && h4SellOk && h1SellOk)
      return { route: "SELL-C-[35-30]-RET", side: "SELL", type: "CONTINUATION" };

    // BRK
    if (rsi >= 30 && rsi < 35
     && slope_sell !== null && slope_sell < -1.0
     && h1SlopeDecel
     && h4SlopeDecel
     && zscore < -0.3
     && zscore > -1.8
     && zscore_h1_max3 !== null && zscore_h1_max3 > -0.3
     && prevHigh3 !== null && prevHigh3 > 35
     && drsiS0Safe && h4SellOk && h1SellOk)
      return { route: "SELL-C-[35-30]-BRK", side: "SELL", type: "CONTINUATION" };

    // ── REVERSAL SELL (haut) ──────────────────────────────────────────
    // [70-65] Confirmed
    if (rsi >= 65 && rsi < 70
     && slope_h1 !== null && slope_h1 < 2
     && slope_h4 !== null && slope_h4 < 3
     && drsi_sell !== null && drsi_sell < -1
     && drsi_h4_s0 !== null && drsi_h4_s0 < -0.5
     && dslope_h1 < -0.25
     && zscore > 0.8
     && prevHigh3 !== null && prevHigh3 > 70)
      return { route: "SELL-R-[70-65]", side: "SELL", type: "REVERSAL" };

    // [75-70] Overbought
    if (rsi >= 70 && rsi < 75
     && slope_h1 !== null && slope_h1 < 2
     && slope_h4 !== null && slope_h4 < 3
     && drsi_sell !== null && drsi_sell < -0.5
     && drsi_h4_s0 !== null && drsi_h4_s0 < 0
     && dslope_h1 < -0.25
     && zscore > 0.3)
      return { route: "SELL-R-[75-70]", side: "SELL", type: "REVERSAL" };

    // [100-75] Extreme overbought
    if (rsi >= 75
     && drsi_sell !== null && drsi_sell < 0
     && slope_h4 !== null && slope_h4 < 3
     && drsi_h4_s0 !== null && drsi_h4_s0 < 0
     && dslope_h1 < -0.25
     && zscore > 0.3)
      return { route: "SELL-R-[100-75]", side: "SELL", type: "REVERSAL" };

    return null;
  }

  // =========================
  // ROUTE → SIGNAL PHASE
  // =========================
  const ROUTE_PHASE = {
    "BUY-R-[0-25]":         "EXTREME_LOW",
    "BUY-R-[25-30]":        "OVERSOLD",
    "BUY-R-[30-35]":        "PULLBACK_LOW",
    "BUY-C-[35-50]-BRK":    "TREND_UP_LOW_BRK",
    "BUY-C-[50-65]-RET":    "TREND_UP_RET",
    "BUY-C-[50-65]-BRK":    "TREND_UP_BRK",
    "BUY-C-[65-70]-RET":    "TREND_UP_HIGH_RET",
    "BUY-C-[65-70]-BRK":    "TREND_UP_HIGH_BRK",
    "SELL-C-[65-50]-RET":   "TREND_DOWN_HIGH_RET",
    "SELL-C-[65-50]-BRK":   "TREND_DOWN_HIGH_BRK",
    "SELL-C-[50-35]-RET":   "TREND_DOWN_RET",
    "SELL-C-[50-35]-BRK":   "TREND_DOWN_BRK",
    "SELL-C-[35-30]-RET":   "TREND_DOWN_DEEP_RET",
    "SELL-C-[35-30]-BRK":   "TREND_DOWN_DEEP_BRK",
    "SELL-R-[70-65]":       "PULLBACK_HIGH",
    "SELL-R-[75-70]":       "OVERBOUGHT",
    "SELL-R-[100-75]":      "EXTREME_HIGH",
  };

  // =========================
  // MAIN — backtest mode (multi-bar)
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
        // s0
        num(row?.slope_h1_s0),
        num(row?.drsi_h1_s0),
        num(row?.zscore_h1_s0),
        // H4 context
        num(row?.drsi_h4),
        num(row?.drsi_h4_s0),
        num(row?.slope_h4),
        num(row?.slope_h4_s0)
      );
      if (!match) continue;

      // Reversal kill switch
      if (match.type === "REVERSAL" && riskCfg.reversalEnabled === false) continue;

      // Intraday gate — CONT only (seuils signés asymétriques)
      const intra = num(row?.intraday_change);
      const intCfg = INTRADAY_CONFIG[symbol] ?? INTRADAY_CONFIG.default;
      if (match.type === "CONTINUATION" && intra !== null) {
        // Block si intraday fort CONTRE la direction
        if (match.side === "SELL" && intra > intCfg.strongUp) continue;
        if (match.side === "BUY"  && intra < intCfg.strongDown) continue;
      }

      const score = match.type === "REVERSAL" ? 80 : Math.max(0, Math.round(
        Math.abs(num(row?.slope_h1) ?? 0) * 50 +
        Math.abs((num(row?.rsi_h1) ?? 50) - 50) * 2
      ));

      if (score < TOP_CFG.scoreMin) continue;

      opps.push({
        type:       match.type,
        regime:     `${match.type}_${match.side}`,
        route:      match.route,
        signalPhase: ROUTE_PHASE[match.route] ?? match.route,
        engine:     "H1",
        index:      i,
        timestamp:  row?.timestamp,
        symbol,
        side:       match.side,
        signalType: match.side,
        score,

        // H4 s1
        slope_h4:   num(row?.slope_h4),
        dslope_h4:  num(row?.dslope_h4),
        drsi_h4:    num(row?.drsi_h4),

        // H4 s0
        slope_h4_s0: num(row?.slope_h4_s0),
        drsi_h4_s0:  num(row?.drsi_h4_s0),

        // H1 s1
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

        // H1 s0
        rsi_h1_s0:    num(row?.rsi_h1_s0),
        slope_h1_s0:  num(row?.slope_h1_s0),
        drsi_h1_s0:   num(row?.drsi_h1_s0),
        zscore_h1_s0: num(row?.zscore_h1_s0),

        // M15
        atr_m15:    num(row?.atr_m15),
        rsi_m15:    num(row?.rsi_m15),
        slope_m15:  num(row?.slope_m15),
        dslope_m15: num(row?.dslope_m15),

        // M5 s1
        rsi_m5:     num(row?.rsi_m5),
        slope_m5:   num(row?.slope_m5),
        dslope_m5:  num(row?.dslope_m5),
        drsi_m5:    num(row?.drsi_m5),
        zscore_m5:  num(row?.zscore_m5),

        // M5 s0
        rsi_m5_s0:    num(row?.rsi_m5_s0),
        slope_m5_s0:  num(row?.slope_m5_s0),
        drsi_m5_s0:   num(row?.drsi_m5_s0),
        zscore_m5_s0: num(row?.zscore_m5_s0),

        close:           num(row?.close),
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
      console.info("TOPOPP H1 v2 (s0)", {
        total_rows: rows.length,
        signals:    opps.length,
      });
    }

    return opps;
  }

  return { evaluate };

})();

export default TopOpportunities_H1;
