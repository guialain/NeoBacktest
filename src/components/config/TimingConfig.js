// ============================================================================
// TIMING CONFIG — Seuils M5 et M1, identiques pour tous les assets
// ============================================================================

export const TIMING_CONFIG = {

  // Filtre weekend — pas d'entrée vendredi ≥ weekendFridayHour, samedi, dimanche
  weekendFridayHour: 17,

  M5: {
    // Overextended — reversal + continuation (spike → risque de retournement)
    overextended: {
      slopeAbs:  5.0,
      dslopeAbs: 4.0,
      drsiAbs:   8.0,
      rsiMax:    63,
      rsiMin:    37,
    },
  },

};
