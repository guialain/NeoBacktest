// ============================================================================
// RISK CONFIG — Paramètres de risque par actif
//   tpPct / slPct       : en % du prix d'entrée (ex: 0.10 = 0.10%)
//   targetLeveragePerTrade : levier cible par trade (compound scaling)
//   contractSize         : taille du contrat (unités de base)
//   refPrice             : prix de référence pour estimations
//   baseToEUR            : facteur de conversion devise de base → EUR
// ============================================================================

export const RISK_CONFIG = {

  EURUSD: {
    tpPct:                  0.060,
    slPct:                  0.15,
    targetLeveragePerTrade: 5,
    contractSize:           100000,
    refPrice:               1.18,
    baseToEUR:              1.0,      // base = EUR
  },

  GBPUSD: {
    tpPct:                  0.07,
    slPct:                  0.12,
    targetLeveragePerTrade: 5,
    contractSize:           100000,
    refPrice:               1.27,
    baseToEUR:              1.076,    // base = GBP ≈ 1.27/1.18 EUR
  },

  USDJPY: {
    tpPct:                  0.10,
    slPct:                  0.21,
    targetLeveragePerTrade: 5,
    contractSize:           100000,
    refPrice:               156.67,
    baseToEUR:              0.847,    // base = USD ≈ 1/1.18 EUR
  },

  EURJPY: {
    tpPct:                  0.10,
    slPct:                  0.24,
    targetLeveragePerTrade: 5,
    contractSize:           100000,
    refPrice:               150.0,
    baseToEUR:              1.0,      // base = EUR
  },

  GBPJPY: {
    tpPct:                  0.07,
    slPct:                  0.14,
    targetLeveragePerTrade: 5,
    contractSize:           100000,
    refPrice:               190.0,
    baseToEUR:              1.076,    // base = GBP ≈ 1.27/1.18 EUR
  },

  EURGBP: {
    tpPct:                  0.05,
    slPct:                  0.10,
    targetLeveragePerTrade: 5,
    contractSize:           100000,
    refPrice:               0.8725,
    baseToEUR:              1.0,      // base = EUR
  },

  default: {
    tpPct:                  0.15,
    slPct:                  0.20,
    targetLeveragePerTrade: 1,
    contractSize:           100000,
    refPrice:               1.0,
    baseToEUR:              1.0,
  },

};

// ============================================================================
// HELPER
// ============================================================================
export function getRiskConfig(symbol) {
  if (!symbol) return RISK_CONFIG.default;
  const clean = String(symbol).trim().toUpperCase();
  return RISK_CONFIG[clean] ?? RISK_CONFIG.default;
}
