// ============================================================================
// TIMING CONFIG — Seuils M5 et M1, identiques pour tous les assets
// ============================================================================

export const TIMING_CONFIG = {

  // Filtre weekend — pas d'entrée vendredi ≥ weekendFridayHour, samedi, dimanche
  weekendFridayHour: 15,


  // ==========================================================================
  // M5
  // ==========================================================================
  M5: {

    // RSI timing — continuation (pas déjà étiré avant entrée)
    rsiBuyMax:  60,
    rsiSellMin: 40,

    // Continuation — alignement minimal slope + momentum recovery
    slopeMin:  0.05,   // slope_m5 > 0.05 pour BUY (aligné haussier)
    dslopeMin: 0.05,  // dslope_m5 > 0.05 pour BUY (reprise momentum)

    // Contrary filter — reversal (isM5Contrary)
    // slopeVetoBuy/Sell asymétriques : un reversal BUY se produit quand M5 est
    // encore légèrement baissier → on n'exige pas slope > 0, juste slope > -0.5
    contrary: {
      rsiBuyMax:     60,
      rsiSellMin:    40,
      slopeVetoBuy: -0.5,   // BUY  : bloqué si slope_m5 < -0.5
      slopeVetoSell: 0.5,   // SELL : bloqué si slope_m5 >  0.5
      dslopeBuyMin: -0.10,
      dslopeSellMax: 0.10,
      drsiBuyMin:   -0.1,
      drsiSellMax:   0.1,
      drsiVetoBuy:  -1.0,
      drsiVetoSell:  1.0,
    },

    // Overextended — reversal + continuation (spike → risque de retournement)
    overextended: {
      slopeAbs:  6.0,
      dslopeAbs: 4.0,
      drsiAbs:   6.0,
    },

    // Momentum floor — reversal (M5 pas encore en mouvement)
    momentumFloor: 0.01,

  },

  // ==========================================================================
  // M1
  // ==========================================================================
  M1: {

    // RSI timing — reversal + continuation (évite d'entrer en haut/bas d'un spike M1)
    rsiBuyMax:  55,
    rsiSellMin: 45,

    // Contrary filter — reversal (slope M1 contre le signal)
    contrary: {
      drsiAbs: 2.0,
    },

    // Overextended — reversal + continuation (spike M1 trop violent)
    overextended: {
      slopeAbs:  6.0,
      dslopeAbs: 6.0,
      drsiAbs:   8.0,
    },

  },

};
