// ============================================================================
// SIGNAL CONFIG — Paramètres H1 des robots de signal, par actif
//   h1Reversal    : détection des retournements H1 (RSI extrêmes + BB)
//   h1Continuation: zones RSI H1 pour continuation de tendance
//   h1SlopeClass  : classification des régimes de slope H1
// ============================================================================

import { DEFAULT_DAILY_MULTIPLIER, DEFAULT_H4_MULTIPLIER } from "./MultipliersConfig.js";

const H1_SLOPE_CLASS = {
  flat:         { min: -0.5,      max:  0.5 },
  up_weak:      { min:  0.5,      max:  1.5 },
  up_strong:    { min:  1.5,      max:  3.0 },
  up_extreme:   { min:  3.0,      max:  Infinity },
  down_weak:    { min: -1.5,      max: -0.5 },
  down_strong:  { min: -3.0,      max: -1.5 },
  down_extreme: { min: -Infinity, max: -3.0 },
};

// ============================================================================
// H1 REVERSAL — paramètres communs (surchargeables par symbole)
// ============================================================================
const H1_REVERSAL_DEFAULTS = {
  rsiWindow:          60,
  rsiWindowH1:         5,
  rsiBuyMax:          27,
  rsiSellMin:         73,
  slopeMin:          0.5,
  slopeMax:         -0.5,
  flipSlopeMin:      1.0,
  flipDslopeMin:     1.0,
  dslopeBuyMin:     0.15,
  dslopeSellMax:   -0.15,
  dbbzBuyMin:       0.20,
  dbbzSellMax:     -0.20,
  slopeH1MaxAbs:     6.0,
  slopeH1BuyMin:     0.5,
  slopeH1SellMax:   -0.5,
  rsiStalenessMargin: 16,
};

// ============================================================================
// SIGNAL CONFIG PAR ACTIF
// ============================================================================
export const SIGNAL_CONFIG = {

  EURUSD: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { rsiBuyMin: 43, rsiBuyMax: 68, rsiSellMin: 32, rsiSellMax: 57 },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_MULTIPLIER },
    h4Multiplier:    { ...DEFAULT_H4_MULTIPLIER },
  },

  GBPUSD: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS, rsiBuyMax: 29, rsiSellMin: 71 },
    h1Continuation:  { rsiBuyMin: 45, rsiBuyMax: 68, rsiSellMin: 32, rsiSellMax: 55 },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_MULTIPLIER },
    h4Multiplier:    { ...DEFAULT_H4_MULTIPLIER },
  },

  USDJPY: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { rsiBuyMin: 43, rsiBuyMax: 68, rsiSellMin: 32, rsiSellMax: 57 },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_MULTIPLIER },
    h4Multiplier:    { ...DEFAULT_H4_MULTIPLIER },
  },

  EURJPY: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { rsiBuyMin: 43, rsiBuyMax: 68, rsiSellMin: 32, rsiSellMax: 57 },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_MULTIPLIER },
    h4Multiplier:    { ...DEFAULT_H4_MULTIPLIER },
  },

  GBPJPY: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { rsiBuyMin: 43, rsiBuyMax: 68, rsiSellMin: 32, rsiSellMax: 57 },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_MULTIPLIER },
    h4Multiplier:    { ...DEFAULT_H4_MULTIPLIER },
  },

  EURGBP: {
    h1Reversal:      { ...H1_REVERSAL_DEFAULTS },
    h1Continuation:  { rsiBuyMin: 43, rsiBuyMax: 68, rsiSellMin: 32, rsiSellMax: 57 },
    h1SlopeClass:    H1_SLOPE_CLASS,
    dailyMultiplier: { ...DEFAULT_DAILY_MULTIPLIER },
    h4Multiplier:    { ...DEFAULT_H4_MULTIPLIER },
  },

  default: {
    h1Reversal: {},
  },

};

// ============================================================================
// HELPER
// ============================================================================
export function getSignalConfig(symbol) {
  if (!symbol) return SIGNAL_CONFIG.default;
  const clean = String(symbol).trim().toUpperCase();
  return SIGNAL_CONFIG[clean] ?? SIGNAL_CONFIG.default;
}
