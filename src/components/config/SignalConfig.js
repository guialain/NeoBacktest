// ============================================================================
// SignalConfig.js — Paramètres H1 généraux (defaults communs à tous les actifs)
//   Les overrides par actif et les multipliers sont dans MultipliersConfig.js
// ============================================================================

import { ASSET_CONFIG } from "./MultipliersConfig.js";

export const H1_SLOPE_CLASS = {
  flat:         { min: -0.5,      max:  0.5 },
  up_weak:      { min:  0.5,      max:  1.5 },
  up_strong:    { min:  1.5,      max:  3.0 },
  up_extreme:   { min:  3.0,      max:  Infinity },
  down_weak:    { min: -1.5,      max: -0.5 },
  down_strong:  { min: -3.0,      max: -1.5 },
  down_extreme: { min: -Infinity, max: -3.0 },
};

export const H1_REVERSAL_DEFAULTS = {
  rsiWindow:           60,
  rsiWindowH1:          5,
  rsiBuyMax:           27,
  rsiSellMin:          73,
  slopeMin:           0.5,
  slopeMax:          -0.5,
  flipSlopeMin:       1.0,
  flipDslopeMin:      1.0,
  dslopeBuyMin:      0.15,
  dslopeSellMax:    -0.15,
  dbbzBuyMin:        0.20,
  dbbzSellMax:      -0.20,
  slopeH1MaxAbs:      6.0,
  slopeH1BuyMin:      0.5,
  slopeH1SellMax:    -0.5,
  rsiStalenessMargin: 16,
};

export const H1_CONTINUATION_DEFAULTS = {
  slopeH1Min:      0.2,   // |slope_h1| minimum
  rsiBuyMin:       43,    // rsi_h1 plancher BUY
  rsiBuyMax:       68,    // rsi_h1 plafond BUY
  rsiSellMin:      32,    // rsi_h1 plancher SELL
  rsiSellMax:      57,    // rsi_h1 plafond SELL
  dslopeH1MaxAbs:  6.0,   // max |dslope_h1| — spike violent
  dslopeH1DirMin: -0.5,   // dslope_h1 plancher BUY
  dslopeH1DirMax:  0.5,   // dslope_h1 plafond SELL
  zscoreH1BuyMin:  0.0,   // zscore_h1 plancher BUY
  zscoreH1BuyMax:  2.0,   // zscore_h1 plafond BUY
  zscoreH1SellMax: 0.0,   // zscore_h1 plafond SELL
  zscoreH1SellMin: -2.0,  // zscore_h1 plancher SELL
  dzH1BuyMax:      0.5,   // dz_h1 plafond BUY
  dzH1SellMin:    -0.5,   // dz_h1 plancher SELL
};

// ============================================================================
// HELPER
// ============================================================================
export function getSignalConfig(symbol) {
  if (!symbol) return ASSET_CONFIG.default;
  const clean = String(symbol).trim().toUpperCase();
  return ASSET_CONFIG[clean] ?? ASSET_CONFIG.default;
}
