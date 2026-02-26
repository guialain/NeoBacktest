// ============================================================================
// MultipliersConfig.js — Multiplicateurs de score contextuels (defaults)
//   Seuils en valeur absolue — le consommateur applique le signe selon la
//   direction (buy: zscore >= threshold, sell: zscore <= -threshold)
//   Chaque actif peut surcharger ces defaults dans SignalConfig.js
// ============================================================================

export const DEFAULT_DAILY_MULTIPLIER = {
  strong_confirm: { threshold: 0.60, multiplier: 1.10 },
  confirm:        { threshold: 0.20, multiplier: 1.05 },
  doubt:          { threshold: 0.10, multiplier: 0.92 },
  strong_against: { threshold: 0.50, multiplier: 0.78 },
};

export const DEFAULT_H4_MULTIPLIER = {
  strong_align: { threshold: 0.55, multiplier: 1.20 },
  align:        { threshold: 0.15, multiplier: 1.10 },
  flat:         { threshold: 0.03, multiplier: 1.00 },
  opposed:      { threshold: 0.15, multiplier: 0.85 },
};
