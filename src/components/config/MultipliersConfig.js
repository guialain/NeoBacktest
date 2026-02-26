// ============================================================================
// MultipliersConfig.js — Multiplicateurs de score contextuels
//   dailyMultiplier : alignement tendance Daily (zscore_d1 proxy)
//   h4Multiplier    : alignement tendance H4 (zscore_h4 proxy)
// ============================================================================

export const DAILY_MULTIPLIER = {
  buy: {
    strong_confirm: { threshold:  0.60, multiplier: 1.10 },
    confirm:        { threshold:  0.20, multiplier: 1.05 },
    doubt:          { threshold: -0.10, multiplier: 0.92 },
    strong_against: { threshold: -0.50, multiplier: 0.78 },
  },
  sell: {
    strong_confirm: { threshold: -0.60, multiplier: 1.10 },
    confirm:        { threshold: -0.20, multiplier: 1.05 },
    doubt:          { threshold:  0.10, multiplier: 0.92 },
    strong_against: { threshold:  0.50, multiplier: 0.78 },
  },
};

export const H4_MULTIPLIER = {
  buy: {
    strong_align: { threshold:  0.55, multiplier: 1.20 },
    align:        { threshold:  0.15, multiplier: 1.10 },
    flat:         { threshold:  0.03, multiplier: 1.00 },
    opposed:      { threshold: -0.15, multiplier: 0.85 },
  },
  sell: {
    strong_align: { threshold: -0.55, multiplier: 1.20 },
    align:        { threshold: -0.15, multiplier: 1.10 },
    flat:         { threshold: -0.03, multiplier: 1.00 },
    opposed:      { threshold:  0.15, multiplier: 0.85 },
  },
};
