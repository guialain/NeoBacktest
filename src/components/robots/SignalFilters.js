// ============================================================================
// SignalFilters.js — M5 MICRO CONTRARY FILTER (v2.2)
// ============================================================================

import { getAssetConfig } from "../config/AssetConfig";

const SignalFilters = (() => {

  const THRESHOLDS = {
    BUY: {
      slope_veto: 0,      
      dslope: -0.10,
      drsi_veto: -1.0,
      drsi: -0.1,
      rsi_max: 61
    },
    SELL: {
      slope_veto: 0,      
      dslope: 0.10,
      drsi_veto: 1.0,
      drsi: 0.1,
      rsi_min: 39
    }
  };

  const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

  // =========================================================
  // WEEKEND FILTER — aucune entrée vendredi ≥ 17h, samedi, dimanche
  // Évite les gaps de réouverture et les marchés illiquides
  // =========================================================
  function isWeekendRisk(opp) {
    const ts = opp?.timestamp;
    if (!ts) return false;

    const [datePart, timePart] = ts.split(" ");
    if (!datePart || !timePart) return false;

    const d = new Date(`${datePart.replace(/\./g, "-")}T${timePart}:00`);
    if (isNaN(d.getTime())) return false;

    const day  = d.getDay();   // 0=dim, 1=lun ... 5=ven, 6=sam
    const hour = d.getHours();

    if (day === 6 || day === 0)        return true; // samedi / dimanche
    if (day === 5 && hour >= 15)       return true; // vendredi ≥ 17h

    return false;
  }

  // =========================================================
  // VOLATILITY FILTER (M15)
  // =========================================================
  function isLowVolatility(opp) {

    const atr    = num(opp?.atr_m15);
    const close  = num(opp?.close);
    const symbol = opp?.symbol;

    if (!symbol) return true;

    const assetCfg = getAssetConfig(symbol);
    const minRatio = assetCfg?.volatility?.minRatio;

    if (!Number.isFinite(atr) || !Number.isFinite(close)) return true;

    const volRatio = atr / close;

    if (Number.isFinite(minRatio) && volRatio < minRatio) return true;

    const maxRatio = assetCfg?.volatility?.maxRatio;
    if (Number.isFinite(maxRatio) && volRatio > maxRatio) return true;

    return false;
  }

  // =========================================================
  // MICRO M5 FILTER
  // =========================================================
  function isM5Contrary(opp, side) {

    const slope  = num(opp?.slope_m5);
    const dslope = num(opp?.dslope_m5);
    const drsi   = num(opp?.drsi_m5);
    const rsi    = num(opp?.rsi_m5);

    if (slope == null || dslope == null || drsi == null || rsi == null)
      return true;

    const t = THRESHOLDS[side];
    if (!t) return true;

    if (side === "BUY") {

      if (rsi > t.rsi_max) return true;

      if (slope < t.slope_veto) return true;

      if (dslope < t.dslope && drsi < t.drsi)
        return true;

      if (drsi < t.drsi_veto)
        return true;
    }

    if (side === "SELL") {

      if (rsi < t.rsi_min) return true;

      if (slope > t.slope_veto) return true;

      if (dslope > t.dslope && drsi > t.drsi)
        return true;

      if (drsi > t.drsi_veto)
        return true;
    }

    return false;
  }

  // =========================================================
// MICRO M5 MOMENTUM FLOOR (nouveau)
// =========================================================
function isM5WeakMomentum(opp, side) {

  const slope  = num(opp?.slope_m5);
  const dslope = num(opp?.dslope_m5);

  if (slope == null || dslope == null)
    return true;

  if (side === "BUY") {
    if (slope  <  0.01) return true;
    if (dslope <  0.01) return true;
  }

  if (side === "SELL") {
    if (slope  > -0.01) return true;
    if (dslope > -0.01) return true;
  }

  return false;
}

  // =========================================================
  // M5 OVEREXTENDED — veto si le M5 s'emballe trop dans le sens du signal
  // Ex : SELL avec dslope_m5 = -3.18 et drsi_m5 = -8.71 → spike baissier,
  //      le prix rebondit immédiatement et touche le SL
  // =========================================================
  function isM5Overextended(opp, side) {
    const slope  = num(opp?.slope_m5);
    const dslope = num(opp?.dslope_m5);
    const drsi   = num(opp?.drsi_m5);

    if (slope === null || dslope === null || drsi === null) return false;

    if (side === "SELL" && (slope < -4.0 || dslope < -4.5 || drsi < -6.0)) return true;
    if (side === "BUY"  && (slope >  4.0 || dslope >  4.5 || drsi >  6.0)) return true;

    return false;
  }

  // =========================================================
  // STALE H1 SIGNAL — veto si le RSI courant s'est trop éloigné de la zone extrême
  // Trades 5/6/7 : RSI était ~75+ puis retombé à 63/66/55 avant l'entrée
  // BUY  : rsi_h1 > rsiBuyMax  + margin → retournement déjà consommé
  // SELL : rsi_h1 < rsiSellMin - margin → retournement déjà consommé
  // =========================================================
  function isStaleH1Signal(opp, side) {
    const rsi = num(opp?.rsi_h1);
    if (rsi === null) return false;

    const assetCfg = getAssetConfig(opp?.symbol);
    const cfg      = assetCfg?.h1Reversal ?? {};
    const margin   = num(cfg.rsiStalenessMargin) ?? 8;

    if (side === "BUY") {
      const threshold = (num(cfg.rsiBuyMax) ?? 25) + margin;
      if (rsi > threshold) return true;
    }

    if (side === "SELL") {
      const threshold = (num(cfg.rsiSellMin) ?? 75) - margin;
      if (rsi < threshold) return true;
    }

    return false;
  }

  // =========================================================
  // H1 TREND EXTREME — veto si tendance H1 trop forte dans le sens contraire
  // Ex : BUY avec slope_h1 = -8.4 → chute libre, SL touché avant tout rebond
  // =========================================================
  function isH1TrendExtreme(opp, side) {
    const slope  = num(opp?.slope_h1);
    if (slope === null) return false;

    const assetCfg = getAssetConfig(opp?.symbol);
    const maxAbs   = num(assetCfg?.h1Reversal?.slopeH1MaxAbs) ?? 5.0;

    if (side === "BUY"  && slope < -maxAbs) return true;
    if (side === "SELL" && slope >  maxAbs) return true;

    return false;
  }

  // =========================================================
  // H1 SLOPE DIRECTION — veto si slope_h1 va dans le mauvais sens
  // BUY  : slope_h1 doit être >= slopeH1BuyMin  (H1 déjà en retournement)
  // SELL : slope_h1 doit être <= slopeH1SellMax
  // =========================================================
  function isH1SlopeAgainst(opp, side) {
    const slope = num(opp?.slope_h1);
    if (slope === null) return false;

    const assetCfg = getAssetConfig(opp?.symbol);
    const cfg      = assetCfg?.h1Reversal ?? {};

    if (side === "BUY") {
      const min = Number.isFinite(num(cfg.slopeH1BuyMin)) ? num(cfg.slopeH1BuyMin) : 0;
      if (slope < min) return true;
    }

    if (side === "SELL") {
      const max = Number.isFinite(num(cfg.slopeH1SellMax)) ? num(cfg.slopeH1SellMax) : 0;
      if (slope > max) return true;
    }

    return false;
  }

  // =========================================================
  // H1 MOMENTUM OVEREXTENDED — veto si dslope_h1 est trop violent
  // BUY  : dslope_h1 > +4.0 → whipsaw haussier instable
  // SELL : dslope_h1 < -4.0 → whipsaw baissier instable (ex: -4.73)
  // =========================================================
  function isH1MomentumOverextended(opp, side) {
    const dslope = num(opp?.dslope_h1);
    if (dslope === null) return false;

    if (side === "BUY"  && dslope >  4.0) return true;
    if (side === "SELL" && dslope < -4.0) return true;

    return false;
  }

  // =========================================================
  // H1 MOMENTUM DIRECTION (faille 3)
  // Vérifie que le momentum H1 tourne dans le sens du signal
  // BUY  : dslope_h1 doit être > 0 (H1 commence à remonter)
  // SELL : dslope_h1 doit être < 0 (H1 commence à baisser)
  // =========================================================
  function isH1MomentumAgainst(opp, side) {
    const dslope = num(opp?.dslope_h1);
    if (dslope === null) return false;

    if (side === "BUY"  && dslope <= -1.0) return true;
    if (side === "SELL" && dslope >=  1.0) return true;

    return false;
  }

  // =========================================================
  // MAIN EVALUATE
  // =========================================================
  function evaluate({ opportunities } = {}) {

    const opps = Array.isArray(opportunities) ? opportunities : [];

    const validOpportunities = [];
    const waitOpportunities  = [];

    for (const opp of opps) {

      const index = num(opp?.index);
      const side  = (opp?.side === "BUY" || opp?.side === "SELL") ? opp.side : null;

      if (!Number.isFinite(index) || !side) {
        waitOpportunities.push(opp);
        continue;
      }

      // 0️⃣ WEEKEND RISK (toutes stratégies)
      if (isWeekendRisk(opp)) {
        waitOpportunities.push({ ...opp, state: "WAIT_WEEKEND" });
        continue;
      }

      // 1️⃣ VOLATILITY (toutes stratégies)
      if (isLowVolatility(opp)) {
        waitOpportunities.push({ ...opp, state: "WAIT_LOW_VOL" });
        continue;
      }

      // ── FILTRES SPÉCIFIQUES PAR TYPE ──────────────────────────────

      if (opp.type === "continuation") {

        // Pour continuation : M5 déjà vérifié à la détection
        // On bloque seulement si M5 s'emballe (spike → risque de retournement)
        if (isM5Overextended(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED" });
          continue;
        }

      } else {

        // ── FILTRES REVERSAL ──────────────────────────────────────────

        // 2️⃣ MICRO M5
        if (isM5Contrary(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_MICRO" });
          continue;
        }

        // 3️⃣ M5 OVEREXTENDED
        if (isM5Overextended(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_M5_OVEREXTENDED" });
          continue;
        }

        // 4️⃣ STALE H1 SIGNAL
        if (isStaleH1Signal(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_STALE_RSI" });
          continue;
        }

        // 5️⃣ H1 TREND EXTREME
        if (isH1TrendExtreme(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_H1_EXTREME" });
          continue;
        }

        // 6️⃣ H1 SLOPE DIRECTION
        if (isH1SlopeAgainst(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_H1_SLOPE" });
          continue;
        }

        // 7️⃣ H1 MOMENTUM OVEREXTENDED
        if (isH1MomentumOverextended(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_H1_OVEREXTENDED" });
          continue;
        }

        // 8️⃣ H1 MOMENTUM DIRECTION
        if (isH1MomentumAgainst(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_H1_MOMENTUM" });
          continue;
        }

        // 9️⃣ MICRO MOMENTUM FLOOR
        if (isM5WeakMomentum(opp, side)) {
          waitOpportunities.push({ ...opp, state: "WAIT_WEAK_M5" });
          continue;
        }

      }

      validOpportunities.push({ ...opp, state: "VALID" });
    }

    return { validOpportunities, waitOpportunities };
  }

  return { evaluate };

})();

export default SignalFilters;