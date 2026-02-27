// ============================================================================
// SignalConfig.js — Paramètres H1 généraux (defaults communs à tous les actifs)
//   Les overrides par actif et les multipliers sont dans MultipliersConfig.js
// ============================================================================

export const H1_REVERSAL_DEFAULTS = {
  rsiWindow:           60,
  rsiWindowH1:          5,
  rsiBuyMax:           29,
  rsiSellMin:          71,
  slopeMin:           0.5,
  slopeMax:          -0.5,
  flipSlopeMin:       1.0,
  flipDslopeMin:      1.0,
  dslopeBuyMin:      0.15,
  dslopeSellMax:    -0.15,
  dbbzBuyMin:        0.10,   // halved: zscore = (close-mid)/(width/2) au lieu de /4
  dbbzSellMax:      -0.10,
  slopeH1MaxAbs:      6.0,
  slopeH1BuyMin:      0.1,
  slopeH1SellMax:    -0.1,
  rsiStalenessMargin:       16,
  earlyScoreBonus:          20,
  dslopeH1OverextendedAbs:  5.0,  // |dslope_h1| max avant whipsaw H1
  dslopeH1AgainstAbs:       0.5,  // |dslope_h1| min pour veto direction H1
  // Reversal basé sur slope extrême (indépendant du RSI)
  // SELL : slope_h1 > +slopeReversalMin AND dslope_h1 < -dslopeReversalMin
  // BUY  : slope_h1 < -slopeReversalMin AND dslope_h1 > +dslopeReversalMin
  slopeReversalMin:  4.0,   // |slope_h1| seuil tendance extrême
  dslopeReversalMin: 1.5,   // |dslope_h1| seuil de flex minimal
};

export const H1_CONTINUATION_DEFAULTS = {
  slopeH1Min:      1.25,  // |slope_h1| plancher — zone plate exclue
  slopeH1Max:      3.5,   // |slope_h1| plafond  — tendance trop extrême exclue
  rsiBuyMin:       43,    // rsi_h1 plancher BUY
  rsiBuyMax:       68,    // rsi_h1 plafond BUY
  rsiSellMin:      32,    // rsi_h1 plancher SELL
  rsiSellMax:      65,    // rsi_h1 plafond SELL
  dslopeH1MaxAbs:  6.0,   // max |dslope_h1| — spike violent
  dslopeH1DirMin: -0.5,   // dslope_h1 plancher BUY (redondant avec dslopeH1BuyMin=1.5)
  dslopeH1DirMax:  0.5,   // dslope_h1 plafond SELL (redondant avec dslopeH1BuyMin=1.5)
  zscoreH1BuyMin:  0.0,   // zscore_h1 plancher BUY  (prix au-dessus midline)
  zscoreH1BuyMax:  1.5,   // zscore_h1 plafond BUY  (p99.5 des z>0; BB band=1.0)
  zscoreH1SellMax: 0.0,   // zscore_h1 plafond SELL (prix sous midline)
  zscoreH1SellMin: -1.5,  // zscore_h1 plancher SELL (p98.6 des |z|<0)
  dzH1BuyMax:      0.8,   // dz_h1 plafond BUY  (p89.7%; équivalent sémantique ancien 0.5/formule*4)
  dzH1SellMin:    -0.8,   // dz_h1 plancher SELL
  dslopeH1BuyMin:  1.5,   // dslope_h1 min BUY  (momentum H1 fort requis)
  dzH1RepliMin:    0.01,  // dz_h1 seuil repli BB (BB en repli si |dz| < 0.01)
};

