// ============================================================================
// RISK CONFIG — Paramètres de risque par actif
//
// ✅ TP/SL basés sur ATR H1 (multiplicateurs)
//
//   tpAtr  : multiplicateur ATR H1 pour le Take Profit
//   slAtr  : multiplicateur ATR H1 pour le Stop Loss
//
//   targetLeveragePerTrade : levier cible par trade (compound scaling)
//   contractSize           : taille du contrat (unités de base par lot)
//   refPrice               : prix de référence pour estimations
//   baseToEUR              : facteur de conversion devise de base → EUR
// ============================================================================

export const RISK_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────

  EURUSD: {
    tpAtr: 0.50, slAtr: 1.45,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 1.1814, baseToEUR: 1.000,
  },
  GBPUSD: {
    tpAtr: 0.45, slAtr: 1.25,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 1.3404, baseToEUR: 1.076,
  },
  USDJPY: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 156.09, baseToEUR: 0.847,
  },
  EURJPY: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 184.41, baseToEUR: 1.000,
  },
  GBPJPY: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 210.42, baseToEUR: 1.076,
  },
  EURGBP: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 0.8763, baseToEUR: 1.000,
  },

  // ── INDEX ─────────────────────────────────────────────────────────────────

  UK_100: {
    tpAtr: 0.45, slAtr: 1.25,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 10863, baseToEUR: 1.076,
  },
  GERMANY_40: {
    tpAtr: 0.45, slAtr: 1.25,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 20000, baseToEUR: 1.000,
  },
  FRANCE_40: {
    tpAtr: 0.45, slAtr: 1.25,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 8555, baseToEUR: 1.000,
  },
  US_30: {
    tpAtr: 0.45, slAtr: 1.25,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 40000, baseToEUR: 0.847,
  },
  US_500: {
    tpAtr: 0.45, slAtr: 1.25,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 5500, baseToEUR: 0.847,
  },
  US_TECH100: {
    tpAtr: 0.45, slAtr: 1.25,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 25958, baseToEUR: 0.847,
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────

  BTCEUR: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 1, refPrice: 90000, baseToEUR: 1.000,
  },
  BTCUSD: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 1, refPrice: 90000, baseToEUR: 0.847,
  },
  BTCJPY: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 1, refPrice: 14000000, baseToEUR: 0.00613,
  },
  ETHUSD: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 1, refPrice: 3000, baseToEUR: 0.847,
  },

  // ── METAL ─────────────────────────────────────────────────────────────────

  GOLD: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 2700, baseToEUR: 0.847,
  },
  SILVER: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 5000, refPrice: 30, baseToEUR: 0.847,
  },
  PALLADIUM: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 1000, baseToEUR: 0.847,
  },
  PLATINUM: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 950, baseToEUR: 0.847,
  },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────

  CRUDEOIL: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 1000, refPrice: 75, baseToEUR: 0.847,
  },
  NATURAL_GAS: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 10000, refPrice: 3.0, baseToEUR: 0.847,
  },
  HEATING_OIL: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 5,
    contractSize: 100000, refPrice: 2.58, baseToEUR: 0.847,
  },

  // ── AGRI ──────────────────────────────────────────────────────────────────

  COCOA: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 10000, baseToEUR: 0.847,
  },
  COFFEE_C: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 37500, refPrice: 3.50, baseToEUR: 0.847,
  },
  WHEAT: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 21,
    contractSize: 5000, refPrice: 5.0, baseToEUR: 0.847,
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────

  default: {
    tpAtr: 1.5, slAtr: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 100000, refPrice: 1.0, baseToEUR: 1.0,
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