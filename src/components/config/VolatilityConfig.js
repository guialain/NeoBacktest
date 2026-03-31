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
  EURUSD:      { lowMax: 0.000554, medMax: 0.000715, highMax: 0.001175 },
  GBPUSD:      { lowMax: 0.000671, medMax: 0.000819, highMax: 0.001276 },
  USDJPY:      { lowMax: 0.000635, medMax: 0.000837, highMax: 0.001474 },
  EURJPY:      { lowMax: 0.000570, medMax: 0.000694, highMax: 0.001198 },
  GBPJPY:      { lowMax: 0.000659, medMax: 0.000810, highMax: 0.001353 },

  // ── INDEX ─────────────────────────────────────────────────────────────────
  UK_100:      { lowMax: 0.001151, medMax: 0.001350, highMax: 0.002041 },
  GERMANY_40:  { lowMax: 0.001185, medMax: 0.001560, highMax: 0.002507 },
  FRANCE_40:   { lowMax: 0.001296, medMax: 0.001508, highMax: 0.002283 },
  US_30:       { lowMax: 0.000879, medMax: 0.001745, highMax: 0.003198 },
  US_500:      { lowMax: 0.000921, medMax: 0.001579, highMax: 0.003150 },
  US_TECH100:  { lowMax: 0.0015, medMax: 0.002227, highMax: 0.004454 },

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  BTCEUR:      { lowMax: 0.002342, medMax: 0.005038, highMax: 0.009660 },
  BTCUSD:      { lowMax: 0.002297, medMax: 0.005003, highMax: 0.009439 },
  ETHUSD:      { lowMax: 0.003305, medMax: 0.006829, highMax: 0.013044 },

  // ── METAL ─────────────────────────────────────────────────────────────────
  GOLD:        { lowMax: 0.002022, medMax: 0.003141, highMax: 0.008317 },
  SILVER:      { lowMax: 0.005900, medMax: 0.008912, highMax: 0.020993 },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────
  CrudeOIL:    { lowMax: 0.003633, medMax: 0.004174, highMax: 0.006392 },

  // ── AGRI ──────────────────────────────────────────────────────────────────
  WHEAT:       { lowMax: 0.001916, medMax: 0.002691, highMax: 0.004492 },

  default:     { lowMax: 0.000549, medMax: 0.000700, highMax: 0.005200 },

};

// Régimes autorisés à trader
export const TRADABLE_REGIMES = new Set(["med", "high", "explo"]);