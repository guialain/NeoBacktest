// ============================================================================
// SignalConfig.js — Paramètres H1 généraux (defaults communs à tous les actifs)
//   Les overrides par actif et les multipliers sont dans MultipliersConfig.js
// ============================================================================

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
  dbbzBuyMin:        0.10,   // halved: zscore = (close-mid)/(width/2) au lieu de /4
  dbbzSellMax:      -0.10,
  slopeH1MaxAbs:      6.0,
  slopeH1BuyMin:      0.5,
  slopeH1SellMax:    -0.5,
  rsiStalenessMargin:       16,
  earlyScoreBonus:          20,
  dslopeH1OverextendedAbs:  5.0,  // |dslope_h1| max avant whipsaw H1
  dslopeH1AgainstAbs:       0.5,  // |dslope_h1| min pour veto direction H1
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
  zscoreH1BuyMin:  0.0,   // zscore_h1 plancher BUY  (prix au-dessus midline)
  zscoreH1BuyMax:  1.5,   // zscore_h1 plafond BUY  (p99.5 des z>0; BB band=1.0)
  zscoreH1SellMax: 0.0,   // zscore_h1 plafond SELL (prix sous midline)
  zscoreH1SellMin: -1.5,  // zscore_h1 plancher SELL (p98.6 des |z|<0)
  dzH1BuyMax:      0.8,   // dz_h1 plafond BUY  (p89.7%; équivalent sémantique ancien 0.5/formule*4)
  dzH1SellMin:    -0.8,   // dz_h1 plancher SELL
  dslopeH1BuyMin:  0.15,  // dslope_h1 min BUY  (momentum H1 insuffisant si < 0.15)
  dzH1RepliMin:    0.01,  // dz_h1 seuil repli BB (BB en repli si |dz| < 0.01)
};

