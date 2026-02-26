// ============================================================================
// MultipliersConfig.js — Configuration par actif
//   Overrides des params H1 (reversal / continuation) et multiplicateurs de score
//   Les defaults généraux sont dans SignalConfig.js
// ============================================================================

import {
  H1_SLOPE_CLASS,
  H1_REVERSAL_DEFAULTS,
  H1_CONTINUATION_DEFAULTS,
} from "./SignalConfig.js";

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

// ============================================================================
// CONFIG PAR ACTIF — overrides + multiplicateurs
// ============================================================================
export const ASSET_CONFIG = {

  EURUSD: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { ...H1_CONTINUATION_DEFAULTS },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
    h4Multiplier:    { ...DEFAULT_H4_LEVELS },
  },

  GBPUSD: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS, rsiBuyMax: 29, rsiSellMin: 71 },
    h1Continuation:  { ...H1_CONTINUATION_DEFAULTS },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
    h4Multiplier:    { ...DEFAULT_H4_LEVELS },
  },

  USDJPY: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { ...H1_CONTINUATION_DEFAULTS },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
    h4Multiplier:    { ...DEFAULT_H4_LEVELS },
  },

  EURJPY: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { ...H1_CONTINUATION_DEFAULTS },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
    h4Multiplier:    { ...DEFAULT_H4_LEVELS },
  },

  GBPJPY: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { ...H1_CONTINUATION_DEFAULTS },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
    h4Multiplier:    { ...DEFAULT_H4_LEVELS },
  },

  EURGBP: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { ...H1_CONTINUATION_DEFAULTS },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_LEVELS },
    h4Multiplier:    { ...DEFAULT_H4_LEVELS },
  },

  default: {
    h1Reversal: {},
  },

};
