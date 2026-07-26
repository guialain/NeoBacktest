// cycleExpert.js — CYCLE EXPERT (%K), barème v4 (owner 2026-07-26).
// --------------------------------------------------------------------------------------------
// LA MÉTRIQUE N'EST PAS LA FORCE, C'EST L'INTÉRÊT D'ENTRER MAINTENANT.
//   D'où l'ordre `SOFT > FAST > EXPLOSIVE` dans la direction visée, inverse de l'intuition : un
//   mouvement explosif est le PIRE point d'entrée (euphorie / panique), souvent suivi d'un
//   ralentissement puis d'un retracement. Le pic de chaque ligne est donc toujours un SOFT.
//   ⚠ CE CLASSEMENT SUPPOSE DES TP COURTS. Avec des TP longs (tenir la tendance), l'ordre
//   redeviendrait `FAST ≥ SOFT > EXPLOSIVE` — le barème est solidaire de la politique de sortie.
//
// DEUX ENTRÉES, ET RIEN D'AUTRE
//   • K level  `stochZone` (moteur) — maturité du cycle, lue sur %K.
//   • ΔK band  `deltaKBand` (moteur) — vitesse du cycle, 7 bandes signées, seuils [4,4 · 13 · 21].
//   ⚠ INDÉPENDANT DE L'IC, contrairement au Pressure Expert : le score porte SON PROPRE signe
//   (+ = intérêt à entrer LONG, − = à entrer SHORT). Aucune orientation externe.
//
// DEUX RÉGIMES DANS UNE SEULE TABLE
//   corps du cycle (LOW / MID / HIGH) → suivi de tendance ; extrêmes → contrarian (fade l'excès).
//   La maturité incline la table : HIGH favorise le long, LOW le short, les extrêmes inversent.
//
// ⚠ NOMMAGE : le moteur nomme les zones EN FRANÇAIS (`stochZone` → EXTREME_BASSE · BASSE · MID ·
//   HAUTE · EXTREME_HAUTE) alors que le barème owner parle EXTREME_LOW…EXTREME_HIGH. On traduit
//   ici, à la frontière, plutôt que de renommer un classificateur que le moteur consomme déjà.
import { weightedGlobal, mirrorViolations } from "./aggregate.js";

// Zone moteur (français) → clé du barème. Une zone inconnue rend `null` (pas d'avis).
const ZONE_TO_LEVEL = {
  EXTREME_BASSE: "EXTREME_LOW",
  BASSE: "LOW",
  MID: "MID",
  HAUTE: "HIGH",
  EXTREME_HAUTE: "EXTREME_HIGH",
};

// ── LA TABLE — 5 niveaux × 7 vitesses. ★ = meilleur point d'entrée de la ligne ────────────────
//   Écrite EXPLICITEMENT, 1:1 avec le document owner, pour qu'un diff soit lisible. L'invariant de
//   miroir n'est pas supposé : il est VÉRIFIÉ par `cycleMirrorCheck()` (cf. le bug v2).
//   ⚠ ÉCART ASSUMÉ AU DOCUMENT v4 (owner 2026-07-26) : les deux SOFT extrêmes passent de ±9 à ±10
//   pour que l'échelle TOUCHE ses bornes. Le rollover précoce en excès haussier et le retournement
//   doux en excès baissier sont les deux meilleurs points d'entrée de toute la table — ils valent
//   donc le maximum. Les deux cases sont miroirs l'une de l'autre, l'invariant tient.
export const CYCLE_TABLE = {
  // Contrarian — excès haussier, on attend le bas.
  EXTREME_HIGH: {
    EXPLOSIVE_UP: -5,   // blow-off / euphorie, on fade
    FAST_UP:      -2,
    SOFT_UP:      +2,   // dernier reste de biais haussier
    FLAT:          0,
    SOFT_DOWN:   -10,   // ★ rollover précoce = meilleure vente de toute la table (borne basse)
    FAST_DOWN:    -6,
    EXPLOSIVE_DOWN: -2, // panique : on ne vend pas le trou
  },
  // Tendance — cycle haussier sain.
  HIGH: {
    EXPLOSIVE_UP: -3,   // euphorie, mauvais point d'entrée
    FAST_UP:      +5,
    SOFT_UP:      +8,   // ★ continuation douce = meilleure entrée longue
    FLAT:          0,
    SOFT_DOWN:    -6,
    FAST_DOWN:    -4,
    EXPLOSIVE_DOWN: -1,
  },
  // Neutre — antisymétrique par construction.
  MID: {
    EXPLOSIVE_UP: -3,
    FAST_UP:      +5,
    SOFT_UP:      +8,   // ★
    FLAT:          0,
    SOFT_DOWN:    -8,   // ★
    FAST_DOWN:    -5,
    EXPLOSIVE_DOWN: +3,
  },
  // Tendance — cycle baissier sain.
  LOW: {
    EXPLOSIVE_UP: +1,
    FAST_UP:      +4,
    SOFT_UP:      +6,
    FLAT:          0,
    SOFT_DOWN:    -8,   // ★ continuation baissière douce = meilleure vente
    FAST_DOWN:    -5,
    EXPLOSIVE_DOWN: +3, // flush / panique : on ne vend pas
  },
  // Contrarian — excès baissier, on attend le haut.
  EXTREME_LOW: {
    EXPLOSIVE_UP: +2,   // on ne court pas après le rebond violent
    FAST_UP:      +6,
    SOFT_UP:     +10,   // ★ retournement doux = meilleure entrée longue (borne haute)
    FLAT:          0,
    SOFT_DOWN:    -2,   // dernier reste de biais baissier
    FAST_DOWN:    +2,
    EXPLOSIVE_DOWN: +5, // capitulation (climax vendeur), on fade
  },
};

// ── AGRÉGATION MULTI-TF ────────────────────────────────────────────────────────────────────────
//   H1 principal · H4 valide le swing · D1 donne le contexte structurel · M15 la réactivité.
//   Somme = 1,00 ⇒ global borné [−10, +10] comme chaque ligne.
export const CYCLE_TF_WEIGHTS = { h1: 0.40, h4: 0.30, d1: 0.15, m15: 0.15 };

export const CYCLE_MIN = -10;
export const CYCLE_MAX = +10;

// Score d'UN timeframe. `null` = pas d'avis (jamais 0) : zone absente, ΔK absent, ou combinaison
//   hors table. 0 reste une OPINION — c'est ce que dit FLAT.
export function cycleScore({ zone, dKBand }) {
  const level = ZONE_TO_LEVEL[zone];
  if (!level || dKBand == null) return null;
  const row = CYCLE_TABLE[level];
  if (!row) return null;
  const s = row[dKBand];
  return Number.isFinite(s) ? s : null;
}

export const cycleGlobal = (perTf) => weightedGlobal(perTf, CYCLE_TF_WEIGHTS);

// ── CONTRÔLE D'INVARIANT ───────────────────────────────────────────────────────────────────────
//   Les trois miroirs annoncés par l'owner : HIGH↔LOW, EXTREME_HIGH↔EXTREME_LOW, et MID sur
//   lui-même. Rend `[]` si tout est exact. À appeler dans un test, ou à la main après édition.
//   ⭐ Ce contrôle existe parce que la v2 du barème portait précisément ce bug : `EXTREME_HIGH`
//   avait été COPIÉ d'`EXTREME_LOW` au lieu d'en être le miroir.
export function cycleMirrorCheck() {
  const T = CYCLE_TABLE;
  return [
    { pair: "HIGH ↔ LOW", bad: mirrorViolations(T.HIGH, T.LOW) },
    { pair: "EXTREME_HIGH ↔ EXTREME_LOW", bad: mirrorViolations(T.EXTREME_HIGH, T.EXTREME_LOW) },
    { pair: "MID ↔ MID", bad: mirrorViolations(T.MID, T.MID) },
  ].filter((r) => r.bad.length);
}
