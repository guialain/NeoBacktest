// ============================================================================
// VOLATILITY CONFIG — Régimes par symbole
// Ratio = ATR_M15 / Close
//
// Régimes :
//   low   : ratio < lowMax           → trop calme, pas de trade
//   med   : ratio ∈ [lowMax, medMax) → volatilité normale, OK
//   high  : ratio ∈ [medMax, highMax)→ volatilité élevée, OK
//   explo : ratio ≥ highMax          → trop violent, pas de trade
// ============================================================================

export const VOLATILITY_CONFIG = {

  EURUSD: { lowMax: 0.00030, medMax: 0.00080, highMax: 0.00220 }, // avg ~0.00075
  GBPUSD: { lowMax: 0.00039, medMax: 0.00100, highMax: 0.00290 }, // avg ~0.00098
  USDJPY: { lowMax: 0.00075, medMax: 0.00160, highMax: 0.00450 }, // avg ~0.00087
  EURJPY: { lowMax: 0.00035, medMax: 0.00100, highMax: 0.00260 }, // avg ~0.00087
  GBPJPY: { lowMax: 0.00046, medMax: 0.00120, highMax: 0.00350 }, // avg ~0.00115
  EURGBP: { lowMax: 0.00023, medMax: 0.00065, highMax: 0.00170 }, // avg ~0.00058

  default: { lowMax: 0.00030, medMax: 0.00100, highMax: 0.00300 },

};

// Régimes autorisés à trader
export const TRADABLE_REGIMES = new Set(["med", "high"]);
