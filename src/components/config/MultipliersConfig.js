// ============================================================================
// MultipliersConfig.js — Configuration par actif
//   Overrides des params H1 (reversal / continuation) et multiplicateurs de score
//   Les defaults généraux sont dans SignalConfig.js
// ============================================================================

import { H1_REVERSAL_DEFAULTS, H1_CONTINUATION_DEFAULTS } from "./SignalConfig.js";
import { getSlopeConfig } from "./SlopeConfig.js";

// ============================================================================
// MULTIPLICATEURS DE SCORE — defaults (valeurs absolues, symétriques buy/sell)
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

// Shorthand pour les entrées sans override
const def = (sym) => ({
  h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
  h1Continuation:  { ...H1_CONTINUATION_DEFAULTS },
  h1SlopeClass:    getSlopeConfig(sym),
  dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
  h4Multiplier:    { ...DEFAULT_H4_LEVELS },
});

// ============================================================================
// CONFIG PAR ACTIF
// ============================================================================
export const ASSET_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────
  EURUSD: {
    ...def("EURUSD"),
    // Calibration empirique EURUSD :
    //   rsi_h1 : mode 43-45 (biais baissier), 70% dans [35, 63], <30 = 3%, >70 = 4%
    //   slope_h1 : 70% dans [-3, +3]  /  dslope_h1 : 80% dans [-2, +2]
    h1Reversal: {
      ...H1_REVERSAL_DEFAULTS,
      slopeH1MaxAbs: 6.0,   // couvre 95%+ des valeurs EURUSD (rendu explicite)
    },
    h1Continuation: {
      ...H1_CONTINUATION_DEFAULTS,
      // ── Slope (distribution slope_h1 / dslope_h1) ──────────────────────────
      slopeH1Min:     0.5,   // zone flat exclue (~30% des bars où |slope_h1| < 0.5)
      dslopeH1MaxAbs: 3.0,   // spike filter : p90 des deltas EURUSD (vs 6.0 défaut)
      // ── RSI (distribution rsi_h1 — biais baissier, mode 43-45) ─────────────
      // Zone normale 70% = [35, 63] → split par le neutre absolu (50) :
      rsiBuyMin:  50,    // BUY : RSI ≥ 50 = au-dessus du mode baissier (confirmé haussier)
      rsiBuyMax:  63,    // BUY : RSI ≤ 63 = borne haute 70% (évite surachat)
      rsiSellMin: 35,    // SELL: RSI ≥ 35 = borne basse 70% (évite survente)
      rsiSellMax: 50,    // SELL: RSI ≤ 50 = sous le neutre (confirmé baissier pour EURUSD)
    },
  },
  GBPUSD: { ...def("GBPUSD"), h1Reversal: { ...H1_REVERSAL_DEFAULTS, rsiBuyMax: 29, rsiSellMin: 71 } },
  USDJPY: def("USDJPY"),
  EURJPY: def("EURJPY"),
  GBPJPY: def("GBPJPY"),
  EURGBP: def("EURGBP"),

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
  BTCJPY: def("BTCJPY"),
  ETHUSD: def("ETHUSD"),

  // ── METAL ─────────────────────────────────────────────────────────────────
  GOLD:      def("GOLD"),
  SILVER:    def("SILVER"),
  PALLADIUM: def("PALLADIUM"),
  PLATINUM:  def("PLATINUM"),

  // ── OIL & GAS ─────────────────────────────────────────────────────────────
  CRUDEOIL:    def("CRUDEOIL"),
  NATURAL_GAS: def("NATURAL_GAS"),
  HEATING_OIL: def("HEATING_OIL"),

  // ── AGRI ──────────────────────────────────────────────────────────────────
  COCOA:    def("COCOA"),
  COFFEE_C: def("COFFEE_C"),
  WHEAT:    def("WHEAT"),

  default: {
    h1Reversal: { ...H1_REVERSAL_DEFAULTS },
  },

};

export function getSignalConfig(symbol) {
  if (!symbol) return ASSET_CONFIG.default;
  const clean = String(symbol).trim().toUpperCase();
  return ASSET_CONFIG[clean] ?? ASSET_CONFIG.default;
}
