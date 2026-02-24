// ============================================================================
// ASSET CONFIG — NEO MATRIX (ROBUST VERSION)
// ============================================================================

export const ASSET_CONFIG = {

  EURUSD: {

    tpPct: 0.07,
    slPct: 0.15,
    baseLot: 0.2,

    // =============================
    // VOLATILITY FILTER
    // =============================
    volatility: {
      minRatio: 0.0012   // ATR_H1 / Close minimum
    },

    // =============================
    // H1 REVERSAL ENGINE
    // =============================
    h1Reversal: {
      rsiWindow: 60,
      rsiWindowH1: 5,
      rsiBuyMax: 25,
      rsiSellMin: 75,
      slopeMin: 0.5,
      slopeMax: -0.5,
      flipSlopeMin: 1.0,
      flipDslopeMin: 1.0,
      dslopeBuyMin: 0.15,
      dslopeSellMax: -0.15,
      dbbzBuyMin: 0.10,
      dbbzSellMax: -0.10
    },

    // =============================
    // H1 SLOPE CLASSIFICATION
    // =============================
    h1SlopeClass: {
      flat:         { min: -0.5, max: 0.5 },

      up_weak:      { min: 0.5,  max: 1.5 },
      up_strong:    { min: 1.5,  max: 3.0 },
      up_extreme:   { min: 3.0,  max: Infinity },

      down_weak:    { min: -1.5, max: -0.5 },
      down_strong:  { min: -3.0, max: -1.5 },
      down_extreme: { min: -Infinity, max: -3.0 }
    },

    // =============================
    // DAILY MULTIPLIER
    // =============================
    dailyMultiplier: {

      buy: {
        strong_confirm: { threshold: 0.60,  multiplier: 1.10 },
        confirm:        { threshold: 0.20,  multiplier: 1.05 },
        doubt:          { threshold: -0.10, multiplier: 0.92 },
        strong_against: { threshold: -0.50, multiplier: 0.78 }
      },

      sell: {
        strong_confirm: { threshold: -0.60, multiplier: 1.10 },
        confirm:        { threshold: -0.20, multiplier: 1.05 },
        doubt:          { threshold: 0.10,  multiplier: 0.92 },
        strong_against: { threshold: 0.50,  multiplier: 0.78 }
      }
    },

    // =============================
    // H4 MULTIPLIER
    // =============================
    h4Multiplier: {

      buy: {
        strong_align: { threshold: 0.55,  multiplier: 1.20 },
        align:        { threshold: 0.15,  multiplier: 1.10 },
        flat:         { threshold: 0.03,  multiplier: 1.00 },
        opposed:      { threshold: -0.15, multiplier: 0.85 }
      },

      sell: {
        strong_align: { threshold: -0.55, multiplier: 1.20 },
        align:        { threshold: -0.15, multiplier: 1.10 },
        flat:         { threshold: -0.03, multiplier: 1.00 },
        opposed:      { threshold: 0.15,  multiplier: 0.85 }
      }
    }

  },

  // =============================
  // DEFAULT FALLBACK
  // =============================
  default: {
    tpPct: 0.15,
    slPct: 0.20,
    baseLot: 0.1,
    volatility: {
      minRatio: 0.001
    },
    h1Reversal: {}
  }

};


// ============================================================================
// SAFE HELPER — CLEAN SYMBOL
// ============================================================================
export function getAssetConfig(symbol) {

  if (!symbol)
    return ASSET_CONFIG.default;

  const cleanSymbol = String(symbol).trim().toUpperCase();

  return ASSET_CONFIG[cleanSymbol] ?? ASSET_CONFIG.default;
}