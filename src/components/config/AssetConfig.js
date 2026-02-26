// ============================================================================
// ASSET CONFIG — NEO MATRIX (ROBUST VERSION)
// ============================================================================

export const ASSET_CONFIG = {

  EURUSD: {

    // =============================
    // H1 REVERSAL ENGINE
    // =============================
    h1Reversal: {
      rsiWindow: 60,
      rsiWindowH1: 5,
      rsiBuyMax: 27,
      rsiSellMin: 73,
      slopeMin: 0.5,
      slopeMax: -0.5,
      flipSlopeMin: 1.0,
      flipDslopeMin: 1.0,
      dslopeBuyMin: 0.15,
      dslopeSellMax: -0.15,
      dbbzBuyMin: 0.20,
      dbbzSellMax: -0.20,
      slopeH1MaxAbs: 6.0,  // veto si |slope_h1| > seuil (chute/montée extrême)
      slopeH1BuyMin: 0.5,      // BUY : slope_h1 doit être >= 0.5 (zone flat exclue)
      slopeH1SellMax: -0.5,    // SELL : slope_h1 doit être <= -0.5 (zone flat exclue)
      rsiStalenessMargin: 16   // veto si rsi_h1 s'est trop éloigné de la zone extrême
    },

    // =============================
    // H1 CONTINUATION (sync reversal)
    // BUY  : rsi_h1 ∈ [rsiBuyMax+margin, 68] = [43, 68]
    // SELL : rsi_h1 ∈ [32, rsiSellMin-margin] = [32, 57]
    // =============================
    h1Continuation: {
      rsiBuyMin:  43,
      rsiBuyMax:  68,
      rsiSellMin: 32,
      rsiSellMax: 57,
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


GBPUSD: {

    // =============================
    // H1 REVERSAL ENGINE
    // =============================
    h1Reversal: {
      rsiWindow: 60,
      rsiWindowH1: 5,
      rsiBuyMax: 29,
      rsiSellMin: 71,
      slopeMin: 0.5,
      slopeMax: -0.5,
      flipSlopeMin: 1.0,
      flipDslopeMin: 1.0,
      dslopeBuyMin: 0.15,
      dslopeSellMax: -0.15,
      dbbzBuyMin: 0.20,
      dbbzSellMax: -0.20,
      slopeH1MaxAbs: 6.0,  // veto si |slope_h1| > seuil (chute/montée extrême)
      slopeH1BuyMin: 0.5,      // BUY : slope_h1 doit être >= 0.5 (zone flat exclue)
      slopeH1SellMax: -0.5,    // SELL : slope_h1 doit être <= -0.5 (zone flat exclue)
      rsiStalenessMargin: 16   // veto si rsi_h1 s'est trop éloigné de la zone extrême
    },

    // =============================
    // H1 CONTINUATION (sync reversal)
    // BUY  : rsi_h1 ∈ [rsiBuyMax+margin, 68] = [45, 68]
    // SELL : rsi_h1 ∈ [32, rsiSellMin-margin] = [32, 55]
    // =============================
    h1Continuation: {
      rsiBuyMin:  45,
      rsiBuyMax:  68,
      rsiSellMin: 32,
      rsiSellMax: 55,
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

 USDJPY: {

    // =============================
    // H1 REVERSAL ENGINE
    // =============================
    h1Reversal: {
      rsiWindow: 60,
      rsiWindowH1: 5,
      rsiBuyMax: 27,
      rsiSellMin: 73,
      slopeMin: 0.5,
      slopeMax: -0.5,
      flipSlopeMin: 1.0,
      flipDslopeMin: 1.0,
      dslopeBuyMin: 0.15,
      dslopeSellMax: -0.15,
      dbbzBuyMin: 0.20,
      dbbzSellMax: -0.20,
      slopeH1MaxAbs: 6.0,  // veto si |slope_h1| > seuil (chute/montée extrême)
      slopeH1BuyMin: 0.5,      // BUY : slope_h1 doit être >= 0.5 (zone flat exclue)
      slopeH1SellMax: -0.5,    // SELL : slope_h1 doit être <= -0.5 (zone flat exclue)
      rsiStalenessMargin: 16   // veto si rsi_h1 s'est trop éloigné de la zone extrême
    },

    // =============================
    // H1 CONTINUATION (sync reversal)
    // BUY  : rsi_h1 ∈ [43, 68]
    // SELL : rsi_h1 ∈ [32, 57]
    // =============================
    h1Continuation: {
      rsiBuyMin:  43,
      rsiBuyMax:  68,
      rsiSellMin: 32,
      rsiSellMax: 57,
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


 EURJPY: {

    // =============================
    // H1 REVERSAL ENGINE
    // =============================
    h1Reversal: {
      rsiWindow: 60,
      rsiWindowH1: 5,
      rsiBuyMax: 27,
      rsiSellMin: 73,
      slopeMin: 0.5,
      slopeMax: -0.5,
      flipSlopeMin: 1.0,
      flipDslopeMin: 1.0,
      dslopeBuyMin: 0.15,
      dslopeSellMax: -0.15,
      dbbzBuyMin: 0.20,
      dbbzSellMax: -0.20,
      slopeH1MaxAbs: 6.0,  // veto si |slope_h1| > seuil (chute/montée extrême)
      slopeH1BuyMin: 0.5,      // BUY : slope_h1 doit être >= 0.5 (zone flat exclue)
      slopeH1SellMax: -0.5,    // SELL : slope_h1 doit être <= -0.5 (zone flat exclue)
      rsiStalenessMargin: 16   // veto si rsi_h1 s'est trop éloigné de la zone extrême
    },

    // =============================
    // H1 CONTINUATION (sync reversal)
    // BUY  : rsi_h1 ∈ [43, 68]
    // SELL : rsi_h1 ∈ [32, 57]
    // =============================
    h1Continuation: {
      rsiBuyMin:  43,
      rsiBuyMax:  68,
      rsiSellMin: 32,
      rsiSellMax: 57,
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


 GBPJPY: {

    // =============================
    // H1 REVERSAL ENGINE
    // =============================
    h1Reversal: {
      rsiWindow: 60,
      rsiWindowH1: 5,
      rsiBuyMax: 27,
      rsiSellMin: 73,
      slopeMin: 0.5,
      slopeMax: -0.5,
      flipSlopeMin: 1.0,
      flipDslopeMin: 1.0,
      dslopeBuyMin: 0.15,
      dslopeSellMax: -0.15,
      dbbzBuyMin: 0.20,
      dbbzSellMax: -0.20,
      slopeH1MaxAbs: 6.0,  // veto si |slope_h1| > seuil (chute/montée extrême)
      slopeH1BuyMin: 0.5,      // BUY : slope_h1 doit être >= 0.5 (zone flat exclue)
      slopeH1SellMax: -0.5,    // SELL : slope_h1 doit être <= -0.5 (zone flat exclue)
      rsiStalenessMargin: 16   // veto si rsi_h1 s'est trop éloigné de la zone extrême
    },

    // =============================
    // H1 CONTINUATION (sync reversal)
    // BUY  : rsi_h1 ∈ [43, 68]
    // SELL : rsi_h1 ∈ [32, 57]
    // =============================
    h1Continuation: {
      rsiBuyMin:  43,
      rsiBuyMax:  68,
      rsiSellMin: 32,
      rsiSellMax: 57,
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

 EURGBP: {

    // =============================
    // H1 REVERSAL ENGINE
    // =============================
    h1Reversal: {
      rsiWindow: 60,
      rsiWindowH1: 5,
      rsiBuyMax: 27,
      rsiSellMin: 73,
      slopeMin: 0.5,
      slopeMax: -0.5,
      flipSlopeMin: 1.0,
      flipDslopeMin: 1.0,
      dslopeBuyMin: 0.15,
      dslopeSellMax: -0.15,
      dbbzBuyMin: 0.20,
      dbbzSellMax: -0.20,
      slopeH1MaxAbs: 6.0,  // veto si |slope_h1| > seuil (chute/montée extrême)
      slopeH1BuyMin: 0.5,      // BUY : slope_h1 doit être >= 0.5 (zone flat exclue)
      slopeH1SellMax: -0.5,    // SELL : slope_h1 doit être <= -0.5 (zone flat exclue)
      rsiStalenessMargin: 16   // veto si rsi_h1 s'est trop éloigné de la zone extrême
    },

    // =============================
    // H1 CONTINUATION (sync reversal)
    // BUY  : rsi_h1 ∈ [43, 68]
    // SELL : rsi_h1 ∈ [32, 57]
    // =============================
    h1Continuation: {
      rsiBuyMin:  43,
      rsiBuyMax:  68,
      rsiSellMin: 32,
      rsiSellMax: 57,
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