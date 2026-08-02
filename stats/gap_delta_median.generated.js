// GENERE -- Neo-Backtest/stats/_calib_gapdelta.mjs. Mediane de |dGAP| PAR ACTIF x PAR NIVEAU.
// Fenetre = cloture -> live, IDENTIQUE a celle de dz (duree variable 1-60 min) : la substitution
//   ne change que la QUANTITE mesuree, pas l horizon. Coupures = Z_DELTA_MULT x cette mediane,
//   donc les 7 colonnes signees et toute leur grammaire restent INCHANGEES.
// REJOUER AU REBUILD. Ordre des niveaux : NO_TENSION | SLACK | TENSE | TENSE_HIGH | EXTREME | SNAPPED
export const GAP_DELTA_MEDIAN = {
  AUDUSD:     [ 0.192,  0.142,  0.180,  0.166,  0.206,  0.359],
  BRENT_OIL:  [ 0.208,  0.288,  0.271,  0.391,  0.540,  0.619],
  BTCUSD:     [ 0.202,  0.202,  0.200,  0.222,  0.290,  0.408],
  COCOA:      [ 0.229,  0.255,  0.384,  0.421,  0.330,  0.504],
  CrudeOIL:   [ 0.207,  0.259,  0.277,  0.339,  0.481,  0.567],
  ETHUSD:     [ 0.210,  0.202,  0.201,  0.222,  0.290,  0.411],
  EURUSD:     [ 0.142,  0.185,  0.165,  0.198,  0.268,  0.273],
  GASOLINE:   [ 0.252,  0.219,  0.241,  0.313,  0.446,  0.725],
  GBPUSD:     [ 0.166,  0.157,  0.210,  0.174,  0.208,  0.372],
  GERMANY_40: [ 0.173,  0.218,  0.282,  0.246,  0.281,  0.611],
  GOLD:       [ 0.165,  0.179,  0.247,  0.209,  0.261,  0.369],
  SILVER:     [ 0.165,  0.160,  0.199,  0.199,  0.314,  0.307],
  UK_100:     [ 0.209,  0.292,  0.300,  0.307,  0.358,  0.420],
  USDCAD:     [ 0.194,  0.199,  0.232,  0.207,  0.283,  0.342],
  USDCHF:     [ 0.235,  0.211,  0.216,  0.206,  0.240,  0.316],
  USDJPY:     [ 0.071,  0.106,  0.147,  0.153,  0.244,  0.682],
  US_30:      [ 0.170,  0.209,  0.184,  0.277,  0.282,  0.402],
  US_500:     [ 0.197,  0.162,  0.260,  0.234,  0.365,  0.277],
  US_TECH100: [ 0.258,  0.265,  0.245,  0.382,  0.360,  0.303],
};
