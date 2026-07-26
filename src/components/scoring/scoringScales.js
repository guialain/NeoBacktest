// scoringScales.js — LES COLONNES de la table de scoring (page Indicateurs, owner 2026-07-26).
// --------------------------------------------------------------------------------------------
// C'EST LE SEUL FICHIER À ÉDITER pour ajouter une colonne ou brancher un barème. `ScoringTable.jsx`
//   ne contient aucun nombre : il lit ce qui est ici.
//
// ⭐ CHAÎNE : valeur brute → BANDE (classificateur du MOTEUR, importé cross-repo) → SCORE (ici).
//   L'UI ne reclasse jamais une valeur elle-même, sinon elle diverge du moteur en silence
//   (cf. `derived_dataset_computed_3x`).
//
// ⚠ PAS DE VALEUR ⇒ CASE VIDE (owner). Un capteur absent, un barème non défini ou une case non
//   spécifiée rendent `null`, JAMAIS 0 : 0 est une OPINION (« aucune information exploitable »,
//   c'est ce que dit MEDIUM chez le Pressure Expert), null est une ABSENCE d'avis. Les confondre
//   est le bug `num("")=0`, déjà payé deux fois.
//
// DEUX FAÇONS DE SCORER UNE COLONNE — une colonne utilise l'une OU l'autre :
//   • `scale`  : table BANDE → score, pour un capteur bandé simple.
//   • `score()`: fonction, pour un EXPERT qui croise plusieurs entrées (le Pressure Expert croise
//                ADX level × dominanceTurn × sens de l'IC). Son barème vit dans son propre module.
// ⚠ `pressureExpert.js` reste sur disque mais N'EST PLUS CÂBLÉ (owner 2026-07-26) : la colonne ADX
//   a été retirée au profit des DI. Le module garde sa connaissance — barème, porte `BALANCED`,
//   orientation par le DI, refonte de `MEDIUM` — au cas où on y reviendrait.
import {
  diScore, diGlobal, DI_MIN, DI_MAX,
} from "./experts/diExpert.js";
import {
  cycleScore, cycleGlobal, CYCLE_MIN, CYCLE_MAX,
} from "./experts/cycleExpert.js";
import {
  zscoreExpertScore, zscoreGlobal, ZSCORE_MIN, ZSCORE_MAX,
} from "./experts/zscoreExpert.js";
import {
  kdScore, kdGlobal, KD_MIN, KD_MAX,
} from "./experts/kdExpert.js";

export const SCORERS = [
  // ── CYCLE EXPERT (%K) — barème v4 dans `experts/cycleExpert.js` ───────────────────────────────
  //   Croise K level × ΔK band. Les 4 TF sont servis (le stochastique est exporté partout).
  //   ⚠ INDÉPENDANT DE L'IC : le score porte son propre signe. Total PONDÉRÉ 0,40 H1 / 0,30 H4 /
  //   0,15 D1 / 0,15 M15, pas sommé.
  {
    id: "k", label: "%K",
    range: [CYCLE_MIN, CYCLE_MAX],
    score: (L) => cycleScore({ zone: L.kBand, dKBand: L.dKBand }),
    total: (perTf) => cycleGlobal(perTf).score,
  },

  // ── DI EXPERT — barème v1 dans `experts/diExpert.js` (remplace le Pressure/ADX) ───────────────
  //   Croise `diGapBand` (7 bandes, LIVE) × `diGapDynamics` (sur CLOSES) = 21 cases.
  //   ⚠ Son TOTAL n'est pas une somme : agrégation PONDÉRÉE 0,65 H1 / 0,35 M15, renormalisée sur les
  //   TF présents. D1/H4 restent vides — les DI ne sont exportés qu'en H1 et M15.
  //   ⚠ `gap` n'est lu que pour orienter la bande `BALANCED`, seul endroit où la bande ne suffit pas.
  {
    id: "di", label: "DI",
    range: [DI_MIN, DI_MAX],
    score: (L) => diScore({ gapBand: L.gapBand, gapDyn: L.gapDynClose, gap: L.gap }),
    total: (perTf) => diGlobal(perTf).score,
  },

  // ⚠ NI ΔK NI Δz EN COLONNE PROPRE (owner 2026-07-26) : un expert croise le NIVEAU et sa VITESSE
  //   dans une seule table — le Cycle Expert consomme K level × ΔK band, le ZScore Expert |z| × Δz.
  //   Une colonne de delta séparée scorerait deux fois la même observable et la ferait peser double
  //   dans toute lecture globale.
  // ── ZSCORE EXPERT — barème v2 dans `experts/zscoreExpert.js` ─────────────────────────────────
  //   Croise `|z|` (6 barreaux, coupés sur le comportement) × `Δz` (7 bandes CALIBRÉES PAR NIVEAU).
  //   ⚠ SEUL EXPERT QUI REÇOIT DU BRUT (`z`, `dZ`) et bande lui-même : ses deux axes n'existent pas
  //   dans le moteur. `zscoreBand` (niveau SIGNÉ) doublait %K à 0,363 de Cramér, et `deltaZBand`
  //   (coupures FIXES) faisait dire à `FLAT` 50 % des barres en bas et 16 % en haut.
  //   ⚠ Le signe vient du CÔTÉ de la bande, pas de Δz : hors `NO_TENSION` la ligne ne change plus
  //   de signe. Mesuré — quand Δz va contre le côté, on reste du même côté à 95-97 % à +1h.
  //   Les 4 TF sont servis. Poids identiques au Cycle POUR L'INSTANT (owner) — à ajuster.
  {
    id: "zscore", label: "Zscore",
    range: [ZSCORE_MIN, ZSCORE_MAX],
    score: (L) => zscoreExpertScore({ z: L.z, dZ: L.dZ }),
    total: (perTf) => zscoreGlobal(perTf).score,
  },
  // ── K/D EXPERT — barème v1 dans `experts/kdExpert.js` ────────────────────────────────────────
  //   Croise la TRANSITION `kdCycleState(s1) → kdCycleState(s0)` × la zone `stochZone(%K)`.
  //   Écrit pour K > D uniquement ; l'autre sens se dérive par miroir DANS `kdScore`, donc une
  //   table asymétrique est impossible à écrire (l'invariant est structurel, pas vérifié après coup).
  //   ⚠ Une barre dont l'état COURANT est `CROSS` rend `null` : l'expert se tait, c3 gère le veto.
  //   ⚠ LA COLONNE `K/D gap signé` A ÉTÉ SUPPRIMÉE (owner 2026-07-26) : `corr(K−D, ΔK) = 0,959` et
  //   même signe 90,3 % du temps — c'est le capteur que le Cycle Expert lit déjà sous le nom `ΔK`.
  //   Le gap signé ne survit ici que comme ORIENTATION, pas comme observable scorée.
  {
    id: "kd", label: "K/D",
    range: [KD_MIN, KD_MAX],
    score: (L) => kdScore({ zone: L.kBand, prevState: L.kdDynPrev, curState: L.kdDyn, gap: L.kd }),
    total: (perTf) => kdGlobal(perTf).score,
  },
];

// Une colonne sait-elle scorer ? (barème branché ou fonction d'expert)
export const isScored = (s) => typeof s.score === "function" || !!s.scale;

// Score d'une cellule — `null` dans tous les cas d'absence, l'UI laisse la case vide.
export function scoreOf(scorer, L, ctx) {
  if (typeof scorer.score === "function") return scorer.score(L, ctx) ?? null;
  if (!scorer.scale) return null;
  const b = scorer.band(L);
  if (b == null) return null;
  const s = scorer.scale[b];
  return Number.isFinite(s) ? s : null;
}

// Total d'une colonne. Par défaut : somme des contributeurs RÉELS (jamais de 0 implicite). Un
//   expert peut imposer la sienne via `total(perTf, ctx)` — `perTf` est indexé par id de TF.
export function totalOf(scorer, perTf) {
  if (typeof scorer.total === "function") return scorer.total(perTf) ?? null;
  const got = Object.values(perTf).filter((v) => v != null);
  return got.length ? got.reduce((a, b) => a + b, 0) : null;
}

// Amplitude de la colonne, pour l'intensité de la couleur : `range` explicite si l'expert en
//   déclare un, sinon lue DEPUIS le barème. Le composant n'a ainsi aucune borne codée en dur.
export function scaleRange(scorer) {
  if (Array.isArray(scorer.range)) {
    const [min, max] = scorer.range;
    return { min, max, signed: min < 0 };
  }
  const vs = scorer.scale ? Object.values(scorer.scale).filter(Number.isFinite) : [];
  if (!vs.length) return { min: 0, max: 0, signed: false };
  const min = Math.min(...vs), max = Math.max(...vs);
  return { min, max, signed: min < 0 };
}
