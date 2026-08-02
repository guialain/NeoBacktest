// GENERE -- ne pas editer a la main. Script : Neo-Backtest/stats/_calib_slopedelta.mjs
// Calibre le 2026-08-02, 24 jours ouvres (2026-06-29 -> 2026-07-30), week-ends exclus.
// Mediane de |(slope_h1_s0 - slope_h1) x signe(slope_h1_s0)| PAR ACTIF x PAR NIVEAU de pente.
// Coupures = Z_DELTA_MULT x cette mediane -- memes 7 colonnes signees que le ZScore, importees.
// PAR NIVEAU, MESURE : la mediane est x2,3 a x3,8 de flat a extreme sur 18 actifs sur 19.
// PAR ACTIF, MESURE : dispersion inter-actifs de 1,40 (strong) a 2,95 (extreme).
// Ordre des niveaux : flat | weak | strong | extreme
export const SLOPE_DELTA_MEDIAN = {
  AUDUSD:      [ 0.729,  0.892,  1.045,  2.022],
  BRENT_OIL:   [ 0.654,  0.720,  1.152,  1.618],
  BTCUSD:      [ 0.788,  0.822,  1.082,  1.813],
  COCOA:       [ 0.765,  0.553,  0.928,  0.796],
  CrudeOIL:    [ 0.695,  0.805,  1.216,  1.712],
  ETHUSD:      [ 0.734,  0.885,  1.102,  2.260],
  EURUSD:      [ 0.731,  0.875,  1.166,  1.933],
  GASOLINE:    [ 0.868,  0.851,  1.109,  2.100],
  GBPUSD:      [ 0.784,  0.887,  1.150,  1.635],
  GERMANY_40:  [ 0.947,  0.766,  1.058,  1.844],
  GOLD:        [ 0.645,  0.870,  1.251,  2.346],
  SILVER:      [ 0.597,  0.810,  1.129,  2.267],
  UK_100:      [ 0.977,  0.953,  1.275,  2.052],
  USDCAD:      [ 0.836,  0.830,  1.221,  2.176],
  USDCHF:      [ 0.601,  0.890,  1.058,  1.777],
  USDJPY:      [ 0.706,  0.813,  1.139,  2.308],
  US_30:       [ 0.836,  0.833,  1.302,  2.148],
  US_500:      [ 0.798,  0.848,  1.268,  1.935],
  US_TECH100:  [ 0.728,  0.716,  1.191,  2.096],
};
