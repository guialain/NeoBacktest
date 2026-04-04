// ============================================================================
// RISK CONFIG — Paramètres de risque par actif
//
// ✅ TP/SL basés sur ATR H1 (multiplicateurs) — alignés avec live
//
//   tpAtr    : multiplicateur ATR H1 pour le Take Profit
//   slAtr    : multiplicateur ATR H1 pour le Stop Loss
//   atrH1Cap : ATR H1 max (P95 historique) — cap vol pour TP/SL
//              Veto anti-spike: si atr_h1 > 2 × atrH1Cap → trade refusé
//
//   spread : spread fixe en unités prix, relevé sur MT5.
//
//   maxHoldH : durée max d'un trade en heures (clôture forcée si dépassé)
//
//   targetLeveragePerTrade : levier cible par trade (compound scaling)
//   contractSize           : taille du contrat (unités de base par lot)
//   refPrice               : prix de référence pour estimations
//   baseToEUR              : facteur de conversion devise de base → EUR
// ============================================================================

export const RISK_CONFIG = {

  // ── FX ────────────────────────────────────────────────────────────────────

  EURUSD: {
    tpAtr: 0.70, slAtr: 1.82, atrH1Cap: 0.00298, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.154, baseToEUR: 1.000,
  },
  GBPUSD: {
    tpAtr: 0.80, slAtr: 2.49, atrH1Cap: 0.00319, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00012,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.323, baseToEUR: 1.076,
  },
  USDJPY: {
    tpAtr: 0.75, slAtr: 1.88, atrH1Cap: 0.439, maxHoldH: 24, reversalEnabled: true,
    spread: 0.013,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 159.60, baseToEUR: 0.847,
  },
  USDCHF: {
    tpAtr: 0.70, slAtr: 1.82, atrH1Cap: 0.00240, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 0.799, baseToEUR: 0.847,
  },
  USDCAD: {
    tpAtr: 0.70, slAtr: 1.82, atrH1Cap: 0.00253, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.3600, baseToEUR: 0.847,
  },
  NZDUSD: {
    tpAtr: 0.65, slAtr: 1.95, atrH1Cap: 0.00186, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 0.5700, baseToEUR: 1.000,
  },
  EURJPY: {
    tpAtr: 0.75, slAtr: 1.88, atrH1Cap: 0.50, maxHoldH: 24, reversalEnabled: true,
    spread: 0.020,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 184.14, baseToEUR: 1.000,
  },
  GBPJPY: {
    tpAtr: 0.80, slAtr: 2.00, atrH1Cap: 0.60, maxHoldH: 24, reversalEnabled: true,
    spread: 0.030,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 211.09, baseToEUR: 1.076,
  },
  AUDUSD: {
    tpAtr: 0.65, slAtr: 1.95, atrH1Cap: 0.00224, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00008,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 0.691, baseToEUR: 0.847,
  },
  EURCAD: {
    tpAtr: 0.70, slAtr: 1.82, atrH1Cap: 0.00352, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00018,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.5600, baseToEUR: 1.000,
  },
  EURCHF: {
    tpAtr: 0.70, slAtr: 1.82, atrH1Cap: 0.00172, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00018,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 0.9400, baseToEUR: 1.000,
  },
  EURAUD: {
    tpAtr: 0.70, slAtr: 1.82, atrH1Cap: 0.00471, maxHoldH: 24, reversalEnabled: true,
    spread: 0.00015,
    targetLeveragePerTrade: 3.0,
    contractSize: 100000, refPrice: 1.7500, baseToEUR: 1.000,
  },

  // ── INDEX ─────────────────────────────────────────────────────────────────

  UK_100: {
    tpAtr: 0.80, slAtr: 2.00, atrH1Cap: 43.6, maxHoldH: 24, reversalEnabled: true,
    spread: 2.0,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 10462, baseToEUR: 1.076,
  },
  GERMANY_40: {
    tpAtr: 0.70, slAtr: 1.89, atrH1Cap: 145.8, maxHoldH: 24, reversalEnabled: true,
    spread: 5.0,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 23366, baseToEUR: 1.000,
  },
  FRANCE_40: {
    tpAtr: 0.70, slAtr: 1.89, atrH1Cap: 53.3, maxHoldH: 24, reversalEnabled: true,
    spread: 2.0,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 7984, baseToEUR: 1.000,
  },
  US_30: {
    tpAtr: 0.70, slAtr: 2.17, atrH1Cap: 245.0, maxHoldH: 24, reversalEnabled: true,
    spread: 7.0,
    targetLeveragePerTrade: 1,
    contractSize: 10, refPrice: 46673, baseToEUR: 0.847,
  },
  US_500: {
    tpAtr: 0.70, slAtr: 1.82, atrH1Cap: 36.75, maxHoldH: 24, reversalEnabled: true,
    spread: 1.0,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 6610, baseToEUR: 0.847,
  },
  US_TECH100: {
    tpAtr: 0.70, slAtr: 1.96, atrH1Cap: 182.85, maxHoldH: 24, reversalEnabled: true,
    spread: 2.25,
    targetLeveragePerTrade: 1,
    contractSize: 100, refPrice: 24145, baseToEUR: 0.847,
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────

  BTCEUR: {
    tpAtr: 0.80, slAtr: 2.00, atrH1Cap: 970.69, maxHoldH: 24, reversalEnabled: true,
    spread: 70.71,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 57870, baseToEUR: 1.000,
  },
  BTCUSD: {
    tpAtr: 0.80, slAtr: 2.00, atrH1Cap: 1129.82, maxHoldH: 24, reversalEnabled: true,
    spread: 51.3,
    targetLeveragePerTrade: 0.3,
    contractSize: 10, refPrice: 66793, baseToEUR: 0.847,
  },
  ETHUSD: {
    tpAtr: 0.80, slAtr: 1.84, atrH1Cap: 62.43, maxHoldH: 24, reversalEnabled: true,
    spread: 1.9,
    targetLeveragePerTrade: 0.3,
    contractSize: 100, refPrice: 2050, baseToEUR: 0.847,
  },

  // ── METAL ─────────────────────────────────────────────────────────────────

  GOLD: {
    tpAtr: 0.50, slAtr: 1.15, atrH1Cap: 38.60, maxHoldH: 24, reversalEnabled: true,
    spread: 1.26,
    targetLeveragePerTrade: 0.75,
    contractSize: 100, refPrice: 4666, baseToEUR: 0.847,
  },
  SILVER: {
    tpAtr: 0.70, slAtr: 1.85, atrH1Cap: 1.653, maxHoldH: 24, reversalEnabled: true,
    spread: 0.148,
    targetLeveragePerTrade: 0.5,
    contractSize: 10000, refPrice: 72.75, baseToEUR: 0.847,
  },

  // ── OIL & GAS ─────────────────────────────────────────────────────────────

  CrudeOIL: {
    tpAtr: 0.80, slAtr: 1.96, atrH1Cap: 1.22, maxHoldH: 24, reversalEnabled: true,
    spread: 0.04,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 111.14, baseToEUR: 0.847,
  },
  BRENT_OIL: {
    tpAtr: 0.80, slAtr: 1.96, atrH1Cap: 1.22, maxHoldH: 24, reversalEnabled: true,
    spread: 0.04,
    targetLeveragePerTrade: 0.5,
    contractSize: 1000, refPrice: 108.65, baseToEUR: 0.847,
  },
  GASOLINE: {
    tpAtr: 0.75, slAtr: 1.88, atrH1Cap: 0.0441, maxHoldH: 24, reversalEnabled: true,
    spread: 0.003,
    targetLeveragePerTrade: 0.5,
    contractSize: 100000, refPrice: 3.27, baseToEUR: 0.847,
  },

  // ── AGRICULTURE ────────────────────────────────────────────────────────────

  WHEAT: {
    tpAtr: 0.60, slAtr: 1.98, atrH1Cap: 5.50, maxHoldH: 24, reversalEnabled: true,
    spread: 0.30,
    targetLeveragePerTrade: 1.0,
    contractSize: 100, refPrice: 597, baseToEUR: 0.847,
  },

  // ── DEFAULT ───────────────────────────────────────────────────────────────

  default: {
    tpAtr: 0.70, slAtr: 1.82,
    spread: 0,
    defaultMaxHoldH: 24,
    targetLeveragePerTrade: 0.25,
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
