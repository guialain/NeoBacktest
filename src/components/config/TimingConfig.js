// ============================================================================
// TIMING CONFIG — Seuils M5 et M1, identiques pour tous les assets
// ============================================================================

export const TIMING_CONFIG = {

  // Filtre weekend — pas d'entrée vendredi ≥ weekendFridayHour, samedi, dimanche
  weekendFridayHour: 15,

  M5: {
    // Overextended — reversal + continuation (spike → risque de retournement)
    overextended: {
      slopeAbs:  5.0,
      dslopeAbs: 3.0,
      drsiAbs:   5.0,
      rsiMax:    65,
      rsiMin:    35,
    },
  },

};
