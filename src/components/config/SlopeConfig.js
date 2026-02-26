// ============================================================================
// SlopeConfig.js — Classification des régimes de slope H1, par actif
// ============================================================================

const DEFAULT_SLOPE_CLASS = {
  flat:         { min: -0.5,      max:  0.5 },
  up_weak:      { min:  0.5,      max:  1.5 },
  up_strong:    { min:  1.5,      max:  3.0 },
  up_extreme:   { min:  3.0,      max:  Infinity },
  down_weak:    { min: -1.5,      max: -0.5 },
  down_strong:  { min: -3.0,      max: -1.5 },
  down_extreme: { min: -Infinity, max: -3.0 },
};

export const SLOPE_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────
  EURUSD: { ...DEFAULT_SLOPE_CLASS },
  GBPUSD: { ...DEFAULT_SLOPE_CLASS },
  USDJPY: { ...DEFAULT_SLOPE_CLASS },
  EURJPY: { ...DEFAULT_SLOPE_CLASS },
  GBPJPY: { ...DEFAULT_SLOPE_CLASS },
  EURGBP: { ...DEFAULT_SLOPE_CLASS },

  // ── INDEX ─────────────────────────────────────────────────────────────────
  UK_100:     { ...DEFAULT_SLOPE_CLASS },
  GERMANY_40: { ...DEFAULT_SLOPE_CLASS },
  FRANCE_40:  { ...DEFAULT_SLOPE_CLASS },
  US_30:      { ...DEFAULT_SLOPE_CLASS },
  US_500:     { ...DEFAULT_SLOPE_CLASS },
  US_TECH100: { ...DEFAULT_SLOPE_CLASS },

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  BTCEUR: { ...DEFAULT_SLOPE_CLASS },
  BTCUSD: { ...DEFAULT_SLOPE_CLASS },
  BTCJPY: { ...DEFAULT_SLOPE_CLASS },
  ETHUSD: { ...DEFAULT_SLOPE_CLASS },

  // ── METAL ─────────────────────────────────────────────────────────────────
  GOLD:      { ...DEFAULT_SLOPE_CLASS },
  SILVER:    { ...DEFAULT_SLOPE_CLASS },
  PALLADIUM: { ...DEFAULT_SLOPE_CLASS },
  PLATINUM:  { ...DEFAULT_SLOPE_CLASS },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────
  CRUDEOIL:    { ...DEFAULT_SLOPE_CLASS },
  NATURAL_GAS: { ...DEFAULT_SLOPE_CLASS },
  HEATING_OIL: { ...DEFAULT_SLOPE_CLASS },

  // ── AGRI ──────────────────────────────────────────────────────────────────
  COCOA:      { ...DEFAULT_SLOPE_CLASS },
  COFFEE_C:   { ...DEFAULT_SLOPE_CLASS },
  "COTTON#2": { ...DEFAULT_SLOPE_CLASS },
  WHEAT:      { ...DEFAULT_SLOPE_CLASS },

  default: { ...DEFAULT_SLOPE_CLASS },
};

export function getSlopeConfig(symbol) {
  if (!symbol) return SLOPE_CONFIG.default;
  const clean = String(symbol).trim().toUpperCase();
  return SLOPE_CONFIG[clean] ?? SLOPE_CONFIG.default;
}
