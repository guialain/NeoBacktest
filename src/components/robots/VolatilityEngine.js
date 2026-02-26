// ============================================================================
// VolatilityEngine.js — Détermine le régime de volatilité d'une barre
// Régimes : "low" | "med" | "high" | "explo"
// ============================================================================

import { VOLATILITY_CONFIG, TRADABLE_REGIMES } from "../config/VolatilityConfig";

const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

// ============================================================================
// getVolatilityRegime — retourne le régime ou null si données invalides
// ============================================================================
export function getVolatilityRegime(symbol, atr, close) {
  const a = num(atr);
  const c = num(close);

  if (a === null || c === null || c <= 0) return null;

  const ratio = a / c;
  const clean = String(symbol ?? "").trim().toUpperCase();
  const cfg   = VOLATILITY_CONFIG[clean] ?? VOLATILITY_CONFIG.default;

  if (ratio < cfg.lowMax)  return "low";
  if (ratio < cfg.medMax)  return "med";
  if (ratio < cfg.highMax) return "high";
  return "explo";
}

// ============================================================================
// isTradable — true si le régime est dans TRADABLE_REGIMES
// ============================================================================
export function isTradable(symbol, atr, close) {
  const regime = getVolatilityRegime(symbol, atr, close);
  return regime !== null && TRADABLE_REGIMES.has(regime);
}
