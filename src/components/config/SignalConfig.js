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
  // ── Phases de reversal (SignalPhaseDetector.detectReversalPhase) ──────────
  // REVERSAL_START : |slope| > matureMax  AND  |anti-dslope| > accelMin × 2
  // CLIMAX_SLOWING : |slope| > matureMax  AND  accelMin ≤ |anti-dslope| ≤ accelMin × 2
  // MATURE_END     : expMax ≤ |slope| ≤ matureMax  AND  |anti-dslope| ≥ accelMin
  // EXPANSION_END  : expMin ≤ |slope| < expMax      AND  |anti-dslope| ≥ accelMin
  phaseExpansionSlopeMin: 1.5,
  phaseExpansionSlopeMax: 3.5,
  phaseMatureSlopeMax:    5.0,
  phaseAccelDslopeMin:    1.5,
};

export const H1_CONTINUATION_DEFAULTS = {
  // ── Phases de continuation (remplacent slopeH1Min/Max + dslopeH1BuyMin dans la détection) ──
  // EXPANSION_ACCELERATING : expMin ≤ |slope| ≤ expMax  AND  signedDslope ≥ accelMin
  // EXPANSION              : expMin ≤ |slope| ≤ expMax  AND  signedDslope > 0
  // EARLY_TREND            : |slope| < expMin            AND  signedDslope ≥ accelMin
  // MATURE_CONTINUATION    : expMax < |slope| ≤ matureMax AND  signedDslope > 0
  phaseExpansionSlopeMin: 1.5,   // frontière EARLY_TREND / EXPANSION
  phaseExpansionSlopeMax: 3.5,   // frontière EXPANSION / MATURE
  phaseMatureSlopeMax:    5.0,   // plafond absolu (au-delà → pas de signal)
  phaseAccelDslopeMin:    1.5,   // seuil momentum fort (EXPANSION_ACCELERATING + EARLY_TREND)
  // ── Champs conservés pour overrides par actif et compteurs diagnostics ─────────────────
  slopeH1Min:      1.25,  // utilisé dans le compteur slopeH1Weak uniquement
  slopeH1Max:      3.5,   // idem
  rsiBuyMin:       43,    // rsi_h1 plancher BUY
  rsiBuyMax:       68,    // rsi_h1 plafond BUY
  rsiSellMin:      32,    // rsi_h1 plancher SELL
  rsiSellMax:      65,    // rsi_h1 plafond SELL
  dslopeH1MaxAbs:  6.0,   // max |dslope_h1| — spike violent (conservé)
  dslopeH1DirMin: -0.5,   // non utilisé en détection (remplacé par phases)
  dslopeH1DirMax:  0.5,   // non utilisé en détection (remplacé par phases)
  zscoreH1BuyMin:  0.0,   // zscore_h1 plancher BUY  (prix au-dessus midline)
  zscoreH1BuyMax:  1.5,   // zscore_h1 plafond BUY  (p99.5 des z>0; BB band=1.0)
  zscoreH1SellMax: 0.0,   // zscore_h1 plafond SELL (prix sous midline)
  zscoreH1SellMin: -1.5,  // zscore_h1 plancher SELL (p98.6 des |z|<0)
  dzH1BuyMax:      0.8,   // dz_h1 plafond BUY  (p89.7%; équivalent sémantique ancien 0.5/formule*4)
  dzH1SellMin:    -0.8,   // dz_h1 plancher SELL
  dslopeH1BuyMin:  1.5,   // dslope_h1 min BUY  (momentum H1 fort requis)
  dzH1RepliMin:    0.01,  // dz_h1 seuil repli BB (BB en repli si |dz| < 0.01)
};

