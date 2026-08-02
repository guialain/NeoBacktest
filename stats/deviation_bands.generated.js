// ⚠ GÉNÉRÉ — ne pas éditer à la main. Script : Neo-Backtest/stats/_calib_deviation.mjs
// Calibré le 2026-08-02 sur data/matrix : 24 jours ouvrés (2026-06-29 → 2026-07-30),
// week-ends exclus, ~18900 barres/actif
// et ~285 deltas de barre H1/actif.
// ⭐ RÉFÉRENCE = LA CLÔTURE. gap = (close_h1_s1 − middle_h1_s1) / ATR_P50, et les coupures
//    reproduisent la population des barreaux de |zscore_h1| (NUE = clôture), pas de |z_s0|.
//    C'est l'instant que lit `zscoreExhScore` depuis le 29/07 — substituer un niveau LIVE à un
//    niveau CLÔTURE changerait la métrique ET l'instant, et rendrait tout A/B inattribuable.
// ⭐ Les deltas sont EXACTS depuis le scan v8.40 (middle_h1_s1) — la v1 approximait la clôture
//    par la dernière ligne de chaque heure, faute de σ à la clôture.
// 🎯 REJOUER À CHAQUE REBUILD — calibrage d'ÉCHELLE par actif, il se périme avec les données.
//   dMean / dGap : |Δ| par barre H1, coupures p30 / p70 / p90 ⇒ FLAT · SOFT · FAST · EXPLOSIVE.
export const DEVIATION_BANDS = {
  AUDUSD:     { gap: [ 0.17,  0.63,  1.12,  1.89,  2.76], dMean: [ 0.03,  0.08,  0.13], dGap: [ 0.14,  0.41,  0.89] },
  BRENT_OIL:  { gap: [ 0.27,  1.23,  2.34,  3.90,  5.28], dMean: [ 0.09,  0.24,  0.44], dGap: [ 0.21,  0.81,  1.38] },
  BTCUSD:     { gap: [ 0.17,  0.85,  1.31,  2.13,  2.89], dMean: [ 0.04,  0.13,  0.19], dGap: [ 0.20,  0.50,  0.88] },
  COCOA:      { gap: [ 0.33,  1.39,  2.14,  3.74,  5.25], dMean: [ 0.06,  0.19,  0.32], dGap: [ 0.29,  0.93,  1.45] },
  CrudeOIL:   { gap: [ 0.25,  1.15,  1.95,  2.94,  3.98], dMean: [ 0.06,  0.20,  0.33], dGap: [ 0.23,  0.70,  1.32] },
  ETHUSD:     { gap: [ 0.18,  0.89,  1.48,  2.06,  2.51], dMean: [ 0.05,  0.14,  0.19], dGap: [ 0.20,  0.52,  1.03] },
  EURUSD:     { gap: [ 0.16,  0.67,  1.07,  1.72,  2.43], dMean: [ 0.04,  0.09,  0.14], dGap: [ 0.17,  0.48,  0.83] },
  GASOLINE:   { gap: [ 0.22,  0.82,  1.28,  2.31,  3.63], dMean: [ 0.05,  0.13,  0.26], dGap: [ 0.22,  0.73,  1.22] },
  GBPUSD:     { gap: [ 0.15,  0.59,  1.02,  1.72,  2.38], dMean: [ 0.04,  0.11,  0.16], dGap: [ 0.17,  0.46,  0.84] },
  GERMANY_40: { gap: [ 0.21,  0.85,  1.45,  2.56,  4.09], dMean: [ 0.04,  0.14,  0.27], dGap: [ 0.21,  0.55,  1.03] },
  GOLD:       { gap: [ 0.22,  0.95,  1.47,  2.35,  2.94], dMean: [ 0.06,  0.14,  0.21], dGap: [ 0.15,  0.54,  0.98] },
  SILVER:     { gap: [ 0.19,  0.80,  1.23,  1.97,  2.62], dMean: [ 0.05,  0.12,  0.17], dGap: [ 0.17,  0.46,  0.87] },
  UK_100:     { gap: [ 0.25,  1.07,  1.73,  2.89,  3.72], dMean: [ 0.05,  0.17,  0.25], dGap: [ 0.25,  0.69,  1.29] },
  USDCAD:     { gap: [ 0.19,  0.69,  1.19,  1.80,  2.67], dMean: [ 0.04,  0.10,  0.15], dGap: [ 0.16,  0.55,  0.94] },
  USDCHF:     { gap: [ 0.18,  0.75,  1.13,  1.75,  2.95], dMean: [ 0.04,  0.11,  0.16], dGap: [ 0.21,  0.54,  0.95] },
  USDJPY:     { gap: [ 0.09,  0.54,  0.97,  1.59,  2.79], dMean: [ 0.03,  0.10,  0.17], dGap: [ 0.11,  0.29,  0.73] },
  US_30:      { gap: [ 0.21,  0.73,  1.24,  2.13,  2.85], dMean: [ 0.04,  0.11,  0.21], dGap: [ 0.17,  0.55,  1.12] },
  US_500:     { gap: [ 0.18,  0.80,  1.23,  1.95,  3.05], dMean: [ 0.03,  0.11,  0.21], dGap: [ 0.16,  0.52,  0.94] },
  US_TECH100: { gap: [ 0.23,  1.13,  1.85,  3.11,  4.01], dMean: [ 0.07,  0.19,  0.29], dGap: [ 0.21,  0.73,  1.39] },
};
