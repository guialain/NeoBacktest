// ============================================================================
// IntradayConfig.js — calibration P95 sur données réelles MQL5
// Source : intraday_change (%) valeur absolue
// strongMax = seuil au-delà duquel le mouvement intraday est trop fort
//             pour ouvrir une continuation CONTRE ce mouvement
// ============================================================================

export const INTRADAY_CONFIG = {
  // Forex
  EURUSD:      { strongMax: 0.41 },
  GBPUSD:      { strongMax: 0.52 },
  USDJPY:      { strongMax: 0.50 },
  EURJPY:      { strongMax: 0.41 },
  GBPJPY:      { strongMax: 0.48 },
  AUDJPY:      { strongMax: 0.45 },
  AUDUSD:      { strongMax: 0.45 },
  NZDUSD:      { strongMax: 0.45 },
  USDCHF:      { strongMax: 0.45 },
  USDCAD:      { strongMax: 0.45 },
  EURGBP:      { strongMax: 0.35 },
  EURCAD:      { strongMax: 0.45 },
  EURCHF:      { strongMax: 0.35 },
  EURAUD:      { strongMax: 0.50 },
  // Indices
  US_30:       { strongMax: 1.14 },
  US_500:      { strongMax: 1.02 },
  US_TECH100:  { strongMax: 1.60 },
  GERMANY_40:  { strongMax: 0.94 },
  FRANCE_40:   { strongMax: 0.98 },
  UK_100:      { strongMax: 0.88 },
  ITALY_40:    { strongMax: 1.00 },
  // Crypto
  BTCUSD:      { strongMax: 2.97 },
  BTCEUR:      { strongMax: 3.54 },
  ETHUSD:      { strongMax: 4.58 },
  // Metals
  GOLD:        { strongMax: 1.76 },
  SILVER:      { strongMax: 4.22 },
  // Energy
  CrudeOIL:    { strongMax: 2.32 },
  BRENT_OIL:   { strongMax: 2.32 },
  GASOLINE:    { strongMax: 2.80 },
  // Agri
  WHEAT:       { strongMax: 1.49 },

  default:     { strongMax: 1.00 },
};
