// ============================================================================
// TIMING CONFIG — Seuils M5 et M1, identiques pour tous les assets
// ============================================================================

export const TIMING_CONFIG = {

  // Filtre weekend — pas d'entrée vendredi ≥ weekendFridayHour, samedi, dimanche
  weekendFridayHour: 20,

  // Fenêtres horaires de trading — format "HH:MM" (heure locale du CSV)
  // Bloque les nouvelles entrées hors fenêtre (les trades ouverts continuent d'être gérés)
  // Override optionnel par symbol ; sinon default s'applique
  tradingHours: {
    default: { start: "09:00", end: "19:30" },

    // ── INDEX EU (07:00–21:00 GMT) ──
    FRANCE_40:  { start: "07:00", end: "21:00" },
    GERMANY_40: { start: "07:00", end: "21:00" },
    UK_100:     { start: "07:00", end: "21:00" },

    // ── INDEX US (13:30–20:00 GMT) ──
    US_30:      { start: "13:30", end: "20:00" },
    US_500:     { start: "13:30", end: "20:00" },
    US_TECH100: { start: "13:30", end: "20:00" },

    // ── METAL (quasi 24h, 01:00–22:00 GMT) ──
    GOLD:       { start: "01:00", end: "22:00" },
    SILVER:     { start: "01:00", end: "22:00" },

    // ── ENERGY ──
    CRUDEOIL:   { start: "01:00", end: "22:00" },
    BRENT_OIL:  { start: "01:00", end: "22:00" },
    GASOLINE:   { start: "01:00", end: "22:00" },

    // ── CRYPTO (24h) ──
    BTCUSD:     { start: "00:00", end: "23:59" },
    BTCEUR:     { start: "00:00", end: "23:59" },
    ETHUSD:     { start: "00:00", end: "23:59" },

    // ── AGRI (13:30–19:15 GMT) ──
    WHEAT:      { start: "13:30", end: "19:15" },
  },

  M5: {

    // =========================================================
    // Micro Direction Threshold
    // Frontière neutre / directionnelle
    // |slope| < threshold  → zone neutre
    // |slope| ≥ threshold  → micro directionnel clair
    // =========================================================
    slopeThreshold: 0.5,

    // =========================================================
    // Overextended — spike terminal (reversal + continuation)
    // =========================================================
    overextended: {
      slopeAbs:  5.0,
      dslopeAbs: 4.0,
      drsiAbs:   8.0,
      rsiMax:    63,
      rsiMin:    37,
    },
  },

};