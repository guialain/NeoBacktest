// ============================================================================
// VOLATILITY CONFIG — Régimes par symbole
// Calibration : P15 / P70 / P95 du ratio ATR_M15 / Close (données réelles)
//
// Régimes :
//   low   : ratio < lowMax           → trop calme, pas de trade
//   med   : ratio ∈ [lowMax, medMax) → volatilité normale, OK
//   high  : ratio ∈ [medMax, highMax)→ volatilité élevée, OK
//   explo : ratio ≥ highMax          → trop violent, pas de trade
// ============================================================================

export const VOLATILITY_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────
  EURUSD: { lowMax: 0.000366, medMax: 0.000670, highMax: 0.001099 },
  GBPUSD: { lowMax: 0.000438, medMax: 0.000787, highMax: 0.001247 },
  USDJPY: { lowMax: 0.000383, medMax: 0.000791, highMax: 0.001387 },
  EURJPY: { lowMax: 0.000349, medMax: 0.000673, highMax: 0.001128 },
  GBPJPY: { lowMax: 0.000423, medMax: 0.000785, highMax: 0.001280 },
  // ── INDEX ─────────────────────────────────────────────────────────────────
  UK_100:     { lowMax: 0.000713, medMax: 0.001290, highMax: 0.001923 },
  GERMANY_40: { lowMax: 0.000818, medMax: 0.001605, highMax: 0.002578 },
  FRANCE_40:  { lowMax: 0.000838, medMax: 0.001545, highMax: 0.002372 },
  US_30:      { lowMax: 0.000750, medMax: 0.001611, highMax: 0.003020 },
  US_500:     { lowMax: 0.00140, medMax: 0.00220, highMax: 0.00450 },
  US_TECH100: { lowMax: 0.00195, medMax: 0.002500, highMax: 0.007500 },

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  BTCEUR: { lowMax: 0.001357, medMax: 0.004538, highMax: 0.009097 },
  BTCUSD: { lowMax: 0.001382, medMax: 0.004515, highMax: 0.008980 },
  BTCJPY: { lowMax: 0.001140, medMax: 0.004234, highMax: 0.008821 },
  ETHUSD: { lowMax: 0.001956, medMax: 0.006066, highMax: 0.012412 },

  // ── METAL ─────────────────────────────────────────────────────────────────
  GOLD:      { lowMax: 0.001263, medMax: 0.002734, highMax: 0.006639 },
  SILVER:    { lowMax: 0.002980, medMax: 0.007135, highMax: 0.016718 },
  PALLADIUM: { lowMax: 0.003537, medMax: 0.007513, highMax: 0.013093 },
  PLATINUM:  { lowMax: 0.003368, medMax: 0.007196, highMax: 0.013234 },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────
  CRUDEOIL:    { lowMax: 0.002042, medMax: 0.003606, highMax: 0.005765 },
  NATURAL_GAS: { lowMax: 0.003843, medMax: 0.009045, highMax: 0.016603 },
  HEATING_OIL: { lowMax: 0.002362, medMax: 0.004057, highMax: 0.006310 },

  // ── AGRI ──────────────────────────────────────────────────────────────────
  COCOA:    { lowMax: 0.004627, medMax: 0.008322, highMax: 0.012310 },
  COFFEE_C: { lowMax: 0.003123, medMax: 0.005498, highMax: 0.007989 },
  WHEAT:    { lowMax: 0.001289, medMax: 0.002599, highMax: 0.004373 },

  default: { lowMax: 0.000366, medMax: 0.000700, highMax: 0.001200 },

};

// Régimes autorisés à trader
export const TRADABLE_REGIMES = new Set(["med", "high"]);