// ============================================================================
// SignalConfig.js — Paramètres H1 généraux (defaults communs à tous les actifs)
//   Les overrides par actif et les multipliers sont dans MultipliersConfig.js
// ============================================================================

export const H1_REVERSAL_DEFAULTS = {
  rsiWindowH1:          5,

  // ── ZONES RSI ────────────────────────────────────────────────────
  //   rsi < rsiBuyMax              → zone principale BUY  (extrême bas)
  //   rsiBuyMax ≤ rsi < rsiBuySemi → zone secondaire BUY
  //   rsiBuySemi ≤ rsi ≤ rsiSellSemi → zone continuation (pas de reversal)
  //   rsiSellSemi < rsi ≤ rsiSellMin → zone secondaire SELL
  //   rsi > rsiSellMin             → zone principale SELL (extrême haut)
  rsiBuyMax:           30,   // seuil extrême BUY (window min)
  rsiSellMin:          70,   // seuil extrême SELL
  rsiBuySemi:          35,   // borne haute zone secondaire BUY
  rsiSellSemi:         65,   // borne basse zone secondaire SELL

  // ── SLOPE GATES ──────────────────────────────────────────────────
  slopeH1Min:          1.25, // |slope_h1| minimal — zones secondaires
  dslopeH1ReversalMin: 0.5,  // dslope_h1 minimal (momentum)

  // ── EARLY FLIP ───────────────────────────────────────────────────
  flipSlopeMin:        1.0,
  flipDslopeMin:       1.0,
  earlyScoreBonus:     20,

  // ── BB DERIVATIVE ────────────────────────────────────────────────
  dbbzBuyMin:          0.10,
  dbbzSellMax:        -0.10,

  // ── PHASES ───────────────────────────────────────────────────────
  phaseExpansionSlopeMin: 1.5,
  phaseExpansionSlopeMax: 3.5,
  phaseMatureSlopeMax:    4.5,
  phaseAccelDslopeMin:    1.5,
};

export const H1_CONTINUATION_DEFAULTS = {
  // ── PHASES ───────────────────────────────────────────────────────
  // EXPANSION_ACCELERATING : expMin ≤ |slope| ≤ expMax  AND  signedDslope ≥ accelMin
  // EXPANSION              : expMin ≤ |slope| ≤ expMax  AND  signedDslope > 0
  // EARLY_TREND            : |slope| < expMin            AND  signedDslope ≥ accelMin
  // MATURE_CONTINUATION    : expMax < |slope| ≤ matureMax AND  signedDslope > 0
  phaseExpansionSlopeMin: 1.5,   // frontière EARLY_TREND / EXPANSION
  phaseExpansionSlopeMax: 3.5,   // frontière EXPANSION / MATURE
  phaseMatureSlopeMax:    5.0,   // plafond absolu
  phaseAccelDslopeMin:    1.5,   // seuil momentum fort

  // ── STRUCTURE ────────────────────────────────────────────────────
  slopeH1MinAbs:   1.0,   // |slope_h1| minimal
  dslopeH1MaxAbs:  6.0,   // spike filter

  // ── ZONE RSI ─────────────────────────────────────────────────────
  rsiContMin:  35,
  rsiContMax:  65,

  // ── BB ───────────────────────────────────────────────────────────
  zscoreH1BuyMin:  0.0,
  zscoreH1BuyMax:  1.5,
  zscoreH1SellMax: 0.0,
  zscoreH1SellMin: -1.5,
  dzH1BuyMax:      0.8,
  dzH1SellMin:    -0.8,
  dzH1RepliMin:    0.01,
};

