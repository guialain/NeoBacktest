// ⚠ GÉNÉRÉ — ne pas éditer à la main. Script : Neo-Backtest/stats/_calib_dslope_h1.mjs
// Calibré le 2026-08-02 sur `dslope_h1` (CLÔTURE → CLÔTURE), 24 jours ouvrés
// (2026-06-29 → 2026-07-30), week-ends exclus, 371697 lignes, 19 actifs.
// Coupures = percentiles de |dslope_h1| REPRODUISANT la table asset-agnostique en place :
//   soft = p21 · acc = p55 · explo = p95. Seule l'ÉCHELLE devient par actif.
// 🔴 `explo` EST FRAGILE : ~300 valeurs distinctes par actif (une par barre H1 sur 24 jours),
//    donc ce p95 repose sur une quinzaine de barres. `soft` et `acc` sont solides.
// 🎯 REJOUER À CHAQUE REBUILD.
export const DSLOPE_H1_CONFIG = {
  AUDUSD:      { soft:  0.47, acc:  1.52, explo:  5.50 },
  BRENT_OIL:   { soft:  0.42, acc:  1.31, explo:  4.64 },
  BTCUSD:      { soft:  0.46, acc:  1.54, explo:  4.49 },
  COCOA:       { soft:  0.48, acc:  1.16, explo:  4.26 },
  CrudeOIL:    { soft:  0.49, acc:  1.57, explo:  4.90 },
  ETHUSD:      { soft:  0.52, acc:  1.43, explo:  5.42 },
  EURUSD:      { soft:  0.54, acc:  1.47, explo:  5.14 },
  GASOLINE:    { soft:  0.45, acc:  1.63, explo:  4.38 },
  GBPUSD:      { soft:  0.55, acc:  1.51, explo:  5.03 },
  GERMANY_40:  { soft:  0.60, acc:  1.58, explo:  4.35 },
  GOLD:        { soft:  0.49, acc:  1.70, explo:  4.73 },
  SILVER:      { soft:  0.59, acc:  1.58, explo:  4.30 },
  UK_100:      { soft:  0.59, acc:  1.62, explo:  4.51 },
  USDCAD:      { soft:  0.57, acc:  1.61, explo:  5.35 },
  USDCHF:      { soft:  0.50, acc:  1.59, explo:  4.68 },
  USDJPY:      { soft:  0.49, acc:  1.46, explo:  4.79 },
  US_30:       { soft:  0.52, acc:  1.58, explo:  5.53 },
  US_500:      { soft:  0.42, acc:  1.50, explo:  5.36 },
  US_TECH100:  { soft:  0.40, acc:  1.41, explo:  4.97 },
  default:     { soft:  0.50, acc:  1.50, explo:  4.70 },
};
