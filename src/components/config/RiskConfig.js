// ============================================================================
// RISK CONFIG — Paramètres de risque par actif
//
// ✅ TP/SL basés sur ATR H1 (multiplicateurs)
//
//   tpAtr  : multiplicateur ATR H1 pour le Take Profit
//   slAtr  : multiplicateur ATR H1 pour le Stop Loss
//
//   spread : spread fixe en unités prix, relevé sur MT5.
//            Source unique dans computeSpreadPrice (priorité après config.spread global).
//
//   maxHoldH : durée max d'un trade en heures (clôture forcée si dépassé)
//             Défaut global = 8h si absent.
//
//   targetLeveragePerTrade : levier cible par trade (compound scaling)
//   contractSize           : taille du contrat (unités de base par lot)
//   refPrice               : prix de référence pour estimations
//   baseToEUR              : facteur de conversion devise de base → EUR
// ============================================================================

export const RISK_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────

  EURUSD: {
    tpAtr: 0.45, slAtr: 1.80, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 1.1611, baseToEUR: 1.000,
  },
  GBPUSD: {
    tpAtr: 0.40, slAtr: 2.60, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00012,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 1.3404, baseToEUR: 1.076,
  },
  USDJPY: {
    tpAtr: 0.25, slAtr: 2.10, maxHoldH: 24, reversalEnabled: true,
    spread: 0.013,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 156.09, baseToEUR: 0.847,
  },
  USDCHF: {
    tpAtr: 0.50, slAtr: 1.40, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 0.8850, baseToEUR: 0.847,
  },
  USDCAD: {
    tpAtr: 0.45, slAtr: 1.45, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 1.3600, baseToEUR: 0.847,
  },
  NZDUSD: {
    tpAtr: 0.45, slAtr: 1.30, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 0.5700, baseToEUR: 1.000,
  },
  EURJPY: {
    tpAtr: 0.45, slAtr: 2.60, maxHoldH: 24, reversalEnabled: true,
    spread: 0.018,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 184.41, baseToEUR: 1.000,
  },
  GBPJPY: {
    tpAtr: 0.45, slAtr: 1.50, maxHoldH: 24, reversalEnabled: true,
    spread: 0.022,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 210.42, baseToEUR: 1.076,
  },
  AUDUSD: {
    tpAtr: 0.40, slAtr: 1.80, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 0.6300, baseToEUR: 1.000,
  },
  EURAUD: {
    tpAtr: 0.50, slAtr: 1.20, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 1.5,
    contractSize: 100000, refPrice: 1.7500, baseToEUR: 1.000,
  },
  // ── INDEX ─────────────────────────────────────────────────────────────────

  UK_100: {
    tpAtr: 0.60, slAtr: 1.50, maxHoldH: 24, reversalEnabled: true,
    spread: 2.0, spread_price: 2.0,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 10863, baseToEUR: 1.076,
  },
  GERMANY_40: {
    tpAtr: 0.40, slAtr: 1.80, maxHoldH: 24, reversalEnabled: true,
    spread: 5.0, spread_price: 2.0,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 20000, baseToEUR: 1.000,
  },
  FRANCE_40: {
    tpAtr: 0.30, slAtr: 2.00, maxHoldH: 24, reversalEnabled: true,
    spread: 2.0, spread_price: 2.0,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 8555, baseToEUR: 1.000,
  },
  US_30: {
    tpAtr: 0.45, slAtr: 2.00, maxHoldH: 24, reversalEnabled: true,
    spread: 7.0, spread_price: 5.0,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 40000, baseToEUR: 0.847,
  },
  US_500: {
    tpAtr: 0.40, slAtr: 2.00, maxHoldH: 24, reversalEnabled: true,
    spread: 1.0, spread_price: 0.50,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 5500, baseToEUR: 0.847,
  },
  US_TECH100: {
    tpAtr: 0.40, slAtr: 1.20, maxHoldH: 24, reversalEnabled: true,
    spread: 2.25, spread_price: 2.50,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 25958, baseToEUR: 0.847,
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────

  BTCEUR: {
    tpAtr: 0.45, slAtr: 1.45, maxHoldH: 24, reversalEnabled: true,
    spread: 70.71, spread_price: 73.10,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 90000, baseToEUR: 1.000,
  },
  BTCUSD: {
    tpAtr: 0.45, slAtr: 1.65, maxHoldH: 24, reversalEnabled: true,
    spread: 51.3, spread_price: 28.16,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 90000, baseToEUR: 0.847,
  },
  ETHUSD: {
    tpAtr: 0.35, slAtr: 1.5, maxHoldH: 24, reversalEnabled: true,
    spread: 1.9, spread_price: 1.08,
    targetLeveragePerTrade: 0.3,
    contractSize: 100, refPrice: 3000, baseToEUR: 0.847,
  },

  // ── METAL ─────────────────────────────────────────────────────────────────

  GOLD: {
    tpAtr: 0.50, slAtr: 1.0, maxHoldH: 24, reversalEnabled: true,
    spread: 1.26, spread_price: 0.45,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 2700, baseToEUR: 0.847,
  },
  SILVER: {
    tpAtr: 0.55, slAtr: 2.85, maxHoldH: 24, reversalEnabled: true,
    spread: 0.148, spread_price: 0.065,
    targetLeveragePerTrade: 0.5,
    contractSize: 10000, refPrice: 30, baseToEUR: 0.847,
  },
  // ── OIL & GAS ─────────────────────────────────────────────────────────────

  CrudeOIL: {
    tpAtr: 0.40, slAtr: 1.20, maxHoldH: 24, reversalEnabled: true,
    spread: 0.04, spread_price: 0.03,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 75, baseToEUR: 0.847,
  },
  BRENT_OIL: {
    tpAtr: 0.40, slAtr: 1.20, maxHoldH: 24, reversalEnabled: true,
    spread: 0.04, spread_price: 0.05,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 75, baseToEUR: 0.847,
  },
  GASOLINE: {
    tpAtr: 0.40, slAtr: 1.20, maxHoldH: 24, reversalEnabled: true,
    spread: 0.003, spread_price: 0.0027,
    targetLeveragePerTrade: 0.5,
    contractSize: 100000, refPrice: 2.10, baseToEUR: 0.847,
  },

  // ── AGRI ──────────────────────────────────────────────────────────────────

  WHEAT: {
    tpAtr: 0.45, slAtr: 1.85, maxHoldH: 24, reversalEnabled: true,
    spread: 0.75, spread_price: 0.75,
    targetLeveragePerTrade: 0.25,
    contractSize: 5000, refPrice: 5.0, baseToEUR: 0.847,
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────

  default: {
    tpAtr: 0.45, slAtr: 1.45,
    spread: 0,
    defaultMaxHoldH: 24,
    targetLeveragePerTrade: 0.5,
    contractSize: 100000, refPrice: 1.0, baseToEUR: 1.0,
  },
};

// ============================================================================
// HELPER
// ============================================================================
export function getRiskConfig(symbol) {
  if (!symbol) return RISK_CONFIG.default;
  const clean = String(symbol).trim();
  return RISK_CONFIG[clean] ?? RISK_CONFIG.default;
}
