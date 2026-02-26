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

  // ── FX ────────────────────────────────────────────────────────────────────
  EURUSD: { lowMax: 0.00030, medMax: 0.00080, highMax: 0.00220 },
  GBPUSD: { lowMax: 0.00039, medMax: 0.00100, highMax: 0.00290 },
  USDJPY: { lowMax: 0.00075, medMax: 0.00160, highMax: 0.00450 },
  EURJPY: { lowMax: 0.00035, medMax: 0.00100, highMax: 0.00260 },
  GBPJPY: { lowMax: 0.00046, medMax: 0.00120, highMax: 0.00350 },
  EURGBP: { lowMax: 0.00023, medMax: 0.00065, highMax: 0.00170 },

  // ── INDEX ─────────────────────────────────────────────────────────────────
  UK_100:     { lowMax: 0.00080, medMax: 0.00200, highMax: 0.00600 },
  GERMANY_40: { lowMax: 0.00100, medMax: 0.00250, highMax: 0.00750 },
  FRANCE_40:  { lowMax: 0.00090, medMax: 0.00220, highMax: 0.00650 },
  US_30:      { lowMax: 0.00060, medMax: 0.00150, highMax: 0.00450 },
  US_500:     { lowMax: 0.00060, medMax: 0.00150, highMax: 0.00450 },
  US_TECH100: { lowMax: 0.00080, medMax: 0.00200, highMax: 0.00600 },

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  BTCEUR: { lowMax: 0.00300, medMax: 0.00800, highMax: 0.02500 },
  BTCUSD: { lowMax: 0.00300, medMax: 0.00800, highMax: 0.02500 },
  BTCJPY: { lowMax: 0.00300, medMax: 0.00800, highMax: 0.02500 },
  ETHUSD: { lowMax: 0.00400, medMax: 0.01000, highMax: 0.03000 },

  // ── METAL ─────────────────────────────────────────────────────────────────
  GOLD:      { lowMax: 0.00060, medMax: 0.00150, highMax: 0.00400 },
  SILVER:    { lowMax: 0.00150, medMax: 0.00400, highMax: 0.01200 },
  PALLADIUM: { lowMax: 0.00200, medMax: 0.00600, highMax: 0.01800 },
  PLATINUM:  { lowMax: 0.00150, medMax: 0.00450, highMax: 0.01400 },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────
  CRUDEOIL:    { lowMax: 0.00100, medMax: 0.00300, highMax: 0.00900 },
  NATURAL_GAS: { lowMax: 0.00500, medMax: 0.01500, highMax: 0.05000 },
  HEATING_OIL: { lowMax: 0.00200, medMax: 0.00600, highMax: 0.02000 },

  // ── AGRI ──────────────────────────────────────────────────────────────────
  COCOA:    { lowMax: 0.00500, medMax: 0.01500, highMax: 0.04500 },
  COFFEE_C: { lowMax: 0.00600, medMax: 0.01800, highMax: 0.05500 },
  WHEAT:    { lowMax: 0.00600, medMax: 0.01800, highMax: 0.05500 },

  default: { lowMax: 0.00030, medMax: 0.00100, highMax: 0.00300 },

};

// Régimes autorisés à trader
export const TRADABLE_REGIMES = new Set(["med", "high"]);
