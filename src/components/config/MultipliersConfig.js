// ============================================================================
// MultipliersConfig.js — Multiplicateurs de score par actif
//   Facteurs H4 et D1 uniquement
//   Config H1 → AssetSignalConfig.js
//   Slope     → SlopeConfig.js
// ============================================================================

import { getSlopeConfig } from "./SlopeConfig.js";

// ============================================================================
// DEFAULTS MULTIPLICATEURS
// ============================================================================

const DEFAULT_DAILY_LEVELS = {
  strong_confirm: { threshold: 0.60, multiplier: 1.10 },
  confirm:        { threshold: 0.20, multiplier: 1.05 },
  doubt:          { threshold: 0.10, multiplier: 0.92 },
  strong_against: { threshold: 0.50, multiplier: 0.78 },
};

const DEFAULT_H4_LEVELS = {
  strong_align: { threshold: 0.55, multiplier: 1.20 },
  align:        { threshold: 0.15, multiplier: 1.10 },
  flat:         { threshold: 0.03, multiplier: 1.00 },
  opposed:      { threshold: 0.15, multiplier: 0.85 },
};

// Shorthand
const def = (sym) => ({
  h1SlopeClass:    getSlopeConfig(sym),
  dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
  h4Multiplier:    { ...DEFAULT_H4_LEVELS },
});

// ============================================================================
// CONFIG PAR ACTIF
// ============================================================================
export const MULTIPLIERS_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────
  EURUSD: def("EURUSD"),
  GBPUSD: def("GBPUSD"),
  USDJPY: def("USDJPY"),
  EURJPY: def("EURJPY"),
  GBPJPY: def("GBPJPY"),
  // ── INDEX ─────────────────────────────────────────────────────────────────
  UK_100:     def("UK_100"),
  GERMANY_40: def("GERMANY_40"),
  FRANCE_40:  def("FRANCE_40"),
  US_30:      def("US_30"),
  US_500:     def("US_500"),
  US_TECH100: def("US_TECH100"),

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  BTCEUR: def("BTCEUR"),
  BTCUSD: def("BTCUSD"),
  ETHUSD: def("ETHUSD"),

  // ── METAL ─────────────────────────────────────────────────────────────────
  GOLD:      def("GOLD"),
  SILVER:    def("SILVER"),
  // ── OIL & GAS ─────────────────────────────────────────────────────────────
  CRUDEOIL:    def("CRUDEOIL"),

  // ── AGRI ──────────────────────────────────────────────────────────────────
  WHEAT:    def("WHEAT"),

  default: {
    h1SlopeClass:    getSlopeConfig("default"),
    dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
    h4Multiplier:    { ...DEFAULT_H4_LEVELS },
  },

};

// ============================================================================
// GETTER
// ============================================================================
export function getMultipliersConfig(symbol) {
  if (!symbol) return MULTIPLIERS_CONFIG.default;
  const clean = String(symbol).trim().toUpperCase();
  return MULTIPLIERS_CONFIG[clean] ?? MULTIPLIERS_CONFIG.default;
}