// ============================================================================
// RISK CONFIG — Paramètres de risque par actif
//   tpPct / slPct            : en % du prix d'entrée (ex: 0.10 = 0.10%)
//   targetLeveragePerTrade   : levier cible par trade (compound scaling)
//   contractSize             : taille du contrat (unités de base par lot)
//   refPrice                 : prix de référence pour estimations
//   baseToEUR                : facteur de conversion devise de base → EUR
// ============================================================================

export const RISK_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────
  EURUSD: {
    tpPct: 0.060, slPct: 0.150,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 1.18,    baseToEUR: 1.000,
  },
  GBPUSD: {
    tpPct: 0.070, slPct: 0.120,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 1.27,    baseToEUR: 1.076,
  },
  USDJPY: {
    tpPct: 0.100, slPct: 0.210,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 156.67,  baseToEUR: 0.847,
  },
  EURJPY: {
    tpPct: 0.100, slPct: 0.240,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 150.0,   baseToEUR: 1.000,
  },
  GBPJPY: {
    tpPct: 0.070, slPct: 0.140,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 190.0,   baseToEUR: 1.076,
  },
  EURGBP: {
    tpPct: 0.050, slPct: 0.100,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 0.8725,  baseToEUR: 1.000,
  },

  // ── INDEX ─────────────────────────────────────────────────────────────────
  UK_100: {
    tpPct: 0.120, slPct: 0.250,
    targetLeveragePerTrade: 5,
    contractSize: 1,      refPrice: 8000,    baseToEUR: 1.076, // GBP
  },
  GERMANY_40: {
    tpPct: 0.120, slPct: 0.250,
    targetLeveragePerTrade: 5,
    contractSize: 1,      refPrice: 20000,   baseToEUR: 1.000, // EUR
  },
  FRANCE_40: {
    tpPct: 0.120, slPct: 0.250,
    targetLeveragePerTrade: 5,
    contractSize: 1,      refPrice: 8000,    baseToEUR: 1.000, // EUR
  },
  US_30: {
    tpPct: 0.100, slPct: 0.200,
    targetLeveragePerTrade: 5,
    contractSize: 1,      refPrice: 40000,   baseToEUR: 0.847,
  },
  US_500: {
    tpPct: 0.100, slPct: 0.200,
    targetLeveragePerTrade: 5,
    contractSize: 1,      refPrice: 5500,    baseToEUR: 0.847,
  },
  US_TECH100: {
    tpPct: 0.120, slPct: 0.250,
    targetLeveragePerTrade: 5,
    contractSize: 1,      refPrice: 22000,   baseToEUR: 0.847,
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  BTCEUR: {
    tpPct: 0.500, slPct: 1.000,
    targetLeveragePerTrade: 1,
    contractSize: 1,      refPrice: 90000,   baseToEUR: 1.000,
  },
  BTCUSD: {
    tpPct: 0.500, slPct: 1.000,
    targetLeveragePerTrade: 1,
    contractSize: 1,      refPrice: 90000,   baseToEUR: 0.847,
  },
  BTCJPY: {
    tpPct: 0.500, slPct: 1.000,
    targetLeveragePerTrade: 1,
    contractSize: 1,      refPrice: 14000000, baseToEUR: 0.00613, // 1 JPY ≈ 1/163 EUR
  },
  ETHUSD: {
    tpPct: 0.500, slPct: 1.000,
    targetLeveragePerTrade: 1,
    contractSize: 1,      refPrice: 3000,    baseToEUR: 0.847,
  },

  // ── METAL ─────────────────────────────────────────────────────────────────
  GOLD: {
    tpPct: 0.150, slPct: 0.300,
    targetLeveragePerTrade: 3,
    contractSize: 100,    refPrice: 2700,    baseToEUR: 0.847, // 100 oz/lot
  },
  SILVER: {
    tpPct: 0.200, slPct: 0.400,
    targetLeveragePerTrade: 3,
    contractSize: 5000,   refPrice: 30,      baseToEUR: 0.847, // 5000 oz/lot
  },
  PALLADIUM: {
    tpPct: 0.250, slPct: 0.500,
    targetLeveragePerTrade: 2,
    contractSize: 100,    refPrice: 1000,    baseToEUR: 0.847,
  },
  PLATINUM: {
    tpPct: 0.250, slPct: 0.500,
    targetLeveragePerTrade: 2,
    contractSize: 100,    refPrice: 950,     baseToEUR: 0.847,
  },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────
  CRUDEOIL: {
    tpPct: 0.250, slPct: 0.500,
    targetLeveragePerTrade: 2,
    contractSize: 1000,   refPrice: 75,      baseToEUR: 0.847, // 1000 barils/lot
  },
  NATURAL_GAS: {
    tpPct: 0.400, slPct: 0.800,
    targetLeveragePerTrade: 1,
    contractSize: 10000,  refPrice: 3.0,     baseToEUR: 0.847, // 10 000 MMBtu/lot
  },
  HEATING_OIL: {
    tpPct: 0.300, slPct: 0.600,
    targetLeveragePerTrade: 2,
    contractSize: 42000,  refPrice: 2.50,    baseToEUR: 0.847, // 42 000 gal/lot
  },

  // ── AGRI ──────────────────────────────────────────────────────────────────
  COCOA: {
    tpPct: 0.300, slPct: 0.600,
    targetLeveragePerTrade: 2,
    contractSize: 10,     refPrice: 10000,   baseToEUR: 0.847, // 10 t/lot
  },
  COFFEE_C: {
    tpPct: 0.350, slPct: 0.700,
    targetLeveragePerTrade: 2,
    contractSize: 37500,  refPrice: 3.50,    baseToEUR: 0.847, // 37 500 lbs/lot
  },
  "COTTON#2": {
    tpPct: 0.300, slPct: 0.600,
    targetLeveragePerTrade: 2,
    contractSize: 50000,  refPrice: 0.80,    baseToEUR: 0.847, // 50 000 lbs/lot
  },
  WHEAT: {
    tpPct: 0.350, slPct: 0.700,
    targetLeveragePerTrade: 2,
    contractSize: 5000,   refPrice: 5.0,     baseToEUR: 0.847, // 5 000 boisseaux/lot
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────
  default: {
    tpPct: 0.150, slPct: 0.200,
    targetLeveragePerTrade: 1,
    contractSize: 100000, refPrice: 1.0,     baseToEUR: 1.0,
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
