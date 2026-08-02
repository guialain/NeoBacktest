// ⚠ GÉNÉRÉ — ne pas éditer à la main. Script : Neo-Backtest/stats/_calib_deviation.mjs
// Calibré le 2026-08-02 sur data/matrix : 24 jours ouvrés (2026-06-29 → 2026-07-30),
// week-ends exclus, ~19600 barres/actif
// et ~287 deltas de clôture/actif.
// 🎯 REJOUER À CHAQUE REBUILD DE DATASET — c'est un CALIBRAGE D'ÉCHELLE par actif, il se périme
//    avec les données (trois précédents le 2026-08-02 : baselines tickflow, bornes ADX, ATRConfig).
//   gap  : cinq coupures reproduisant EXACTEMENT la population des barreaux |z| 0,30/1,05/1,55/2,15/2,60
//          ⇒ on change de métrique SANS changer la sélectivité. Comparaison possible à populations égales.
//   dMean / dGap : |Δ| par barre H1, coupures p30 / p70 / p90 ⇒ FLAT · SOFT · FAST · EXPLOSIVE (signées).
export const DEVIATION_BANDS = {
  AUDUSD:     { gap: [ 0.17,  0.63,  1.11,  2.02,  3.55], dMean: [ 0.03,  0.08,  0.14], dGap: [ 0.14,  0.39,  0.79] },
  BRENT_OIL:  { gap: [ 0.23,  1.31,  2.36,  4.18,  5.65], dMean: [ 0.09,  0.24,  0.44], dGap: [ 0.22,  0.79,  1.42] },
  BTCUSD:     { gap: [ 0.19,  0.84,  1.37,  2.36,  3.16], dMean: [ 0.04,  0.13,  0.20], dGap: [ 0.20,  0.50,  0.91] },
  COCOA:      { gap: [ 0.30,  1.49,  2.68,  3.96,  5.64], dMean: [ 0.06,  0.19,  0.32], dGap: [ 0.28,  0.93,  1.45] },
  CrudeOIL:   { gap: [ 0.23,  1.10,  1.97,  3.29,  4.30], dMean: [ 0.06,  0.20,  0.31], dGap: [ 0.21,  0.75,  1.36] },
  ETHUSD:     { gap: [ 0.17,  0.87,  1.48,  2.17,  3.31], dMean: [ 0.05,  0.14,  0.19], dGap: [ 0.18,  0.52,  0.93] },
  EURUSD:     { gap: [ 0.15,  0.64,  1.09,  1.80,  3.05], dMean: [ 0.04,  0.09,  0.15], dGap: [ 0.15,  0.47,  0.85] },
  GASOLINE:   { gap: [ 0.24,  0.85,  1.33,  2.30,  3.75], dMean: [ 0.05,  0.13,  0.24], dGap: [ 0.21,  0.71,  1.18] },
  GBPUSD:     { gap: [ 0.15,  0.58,  1.09,  1.86,  2.89], dMean: [ 0.04,  0.11,  0.17], dGap: [ 0.15,  0.46,  0.76] },
  GERMANY_40: { gap: [ 0.22,  0.84,  1.59,  2.84,  4.45], dMean: [ 0.04,  0.14,  0.28], dGap: [ 0.20,  0.54,  0.98] },
  GOLD:       { gap: [ 0.21,  0.95,  1.56,  2.64,  3.23], dMean: [ 0.06,  0.14,  0.21], dGap: [ 0.17,  0.56,  0.92] },
  SILVER:     { gap: [ 0.18,  0.80,  1.27,  2.06,  2.78], dMean: [ 0.05,  0.12,  0.18], dGap: [ 0.17,  0.45,  0.87] },
  UK_100:     { gap: [ 0.25,  1.13,  1.90,  2.79,  3.83], dMean: [ 0.05,  0.18,  0.26], dGap: [ 0.25,  0.64,  1.21] },
  USDCAD:     { gap: [ 0.17,  0.71,  1.21,  1.85,  2.90], dMean: [ 0.04,  0.10,  0.15], dGap: [ 0.19,  0.51,  0.89] },
  USDCHF:     { gap: [ 0.17,  0.70,  1.18,  1.99,  3.60], dMean: [ 0.05,  0.11,  0.17], dGap: [ 0.18,  0.51,  0.89] },
  USDJPY:     { gap: [ 0.11,  0.52,  0.98,  1.74,  3.77], dMean: [ 0.03,  0.10,  0.18], dGap: [ 0.10,  0.31,  0.72] },
  US_30:      { gap: [ 0.19,  0.74,  1.24,  2.20,  3.02], dMean: [ 0.04,  0.11,  0.21], dGap: [ 0.18,  0.55,  1.08] },
  US_500:     { gap: [ 0.18,  0.79,  1.23,  2.03,  3.26], dMean: [ 0.03,  0.12,  0.21], dGap: [ 0.17,  0.51,  1.02] },
  US_TECH100: { gap: [ 0.26,  1.15,  1.84,  3.28,  4.68], dMean: [ 0.07,  0.20,  0.30], dGap: [ 0.18,  0.73,  1.29] },
};
