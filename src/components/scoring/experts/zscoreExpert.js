// zscoreExpert.js — ZSCORE EXPERT (position vs moyenne), barème v1 (owner 2026-07-26).
// --------------------------------------------------------------------------------------------
// LE ZSCORE EST UN ÉLASTIQUE, PAS UN CYCLE — c'est ce qui sépare cet expert du Cycle Expert.
//   z = (prix − moyenne) / sigma sur Bollinger(20). Il mesure un ÉTIREMENT doté d'une force de
//   rappel MÉCANIQUE, là où %K est un oscillateur borné 0-100 qui SATURE.
//
// DEUX CONSÉQUENCES QUE LA TABLE PORTE, ET QUE CELLE DU CYCLE N'A PAS À PORTER
//   1. LE COUPLE (signe de z, signe de Δz) DIT « S'ÉTIRE » OU « SE RELÂCHE ». Au-dessus de la
//      moyenne, `Δz > 0` = le prix s'éloigne encore ; en dessous, `Δz > 0` = il revient. Pour %K,
//      `ΔK > 0` veut toujours dire « le cycle avance ». C'est le résidu identifié le 25/07 :
//      l'ÉTIREMENT QUI SE RELÂCHE n'est pas LA DÉRIVE QUI S'INSTALLE, et le niveau seul les confond.
//   2. UN EXTRÊME SE RÉSOUT AUSSI PAR LE TEMPS : la moyenne 20 barres rattrape le prix. Un z extrême
//      qui STAGNE n'est donc pas une absence d'information — voir `FLAT` plus bas.
//
// DEUX ENTRÉES, ET RIEN D'AUTRE
//   • zscoreBand (moteur) — 5 bandes signées, seuils [−2,15 · −0,65 · +0,65 · +2,15], pop. 5/30/30/30/5.
//   • deltaZBand (moteur) — 7 bandes signées, seuils [±0,18 · ±0,58 · ±1,12], pop. 5/10/20/30/20/10/5.
//   ⚠ INDÉPENDANT DE L'IC, comme le Cycle Expert : le score porte SON PROPRE signe
//   (+ = intérêt à entrer LONG, − = à entrer SHORT).
//
// DOCTRINE REPRISE DE LA v4 DU CYCLE : métrique = INTÉRÊT D'ENTRER, pas force ⇒ SOFT > FAST >
//   EXPLOSIVE dans la direction visée ; on n'achète pas l'euphorie, on ne vend pas la panique ;
//   corps de la distribution = suivi, extrêmes = contrarian. ⚠ Solidaire de TP COURTS.
import { weightedGlobal, mirrorViolations } from "./aggregate.js";

// ── LA TABLE — 5 bandes × 7 vitesses. ★ = meilleur point d'entrée de la ligne ──────────────────
//   Écrite explicitement pour rester diffable à l'œil ; l'invariant de miroir est VÉRIFIÉ par
//   `zscoreMirrorCheck()`, pas supposé (cf. le bug v2 du Cycle : une table copiée au lieu d'être
//   miroitée).
export const ZSCORE_TABLE = {
  // Contrarian — étirement haussier extrême (p95+), la force de rappel domine.
  EXTREME_UPPER: {
    EXPLOSIVE_UP:   -4,   // blow-off : on fade, sans se mettre en travers d'un mouvement violent
    FAST_UP:        -2,
    SOFT_UP:         0,   // s'étirer AU-DELÀ de p95 n'est pas une entrée longue
    FLAT:           -3,   // ⭐ voir la note FLAT ci-dessous — l'immobilité EN EXTRÊME informe
    SOFT_DOWN:     -10,   // ★ relâchement précoce depuis l'étirement max = meilleure vente
    FAST_DOWN:      -7,
    EXPLOSIVE_DOWN: -2,   // le rappel est déjà consommé, on ne vend pas le trou
  },
  // Suivi de tendance — au-dessus de la moyenne, mais il reste de la place jusqu'à p95.
  UPPER: {
    EXPLOSIVE_UP:   -3,   // euphorie, mauvais point d'entrée
    FAST_UP:        +4,
    SOFT_UP:        +7,   // ★ dérive haussière douce = meilleure entrée longue
    FLAT:            0,
    SOFT_DOWN:      -6,   // début de retour vers la moyenne
    FAST_DOWN:      -4,
    EXPLOSIVE_DOWN: -1,
  },
  // Neutre — antisymétrique. La dérive s'installe depuis la moyenne, toute la bande devant soi.
  NEUTRAL: {
    EXPLOSIVE_UP:   -2,   // moins puni qu'en UPPER : partir de la moyenne, c'est être TÔT
    FAST_UP:        +5,
    SOFT_UP:        +8,   // ★
    FLAT:            0,
    SOFT_DOWN:      -8,   // ★
    FAST_DOWN:      -5,
    EXPLOSIVE_DOWN: +2,
  },
  // Miroir d'UPPER.
  LOWER: {
    EXPLOSIVE_UP:   +1,
    FAST_UP:        +4,
    SOFT_UP:        +6,
    FLAT:            0,
    SOFT_DOWN:      -7,   // ★ dérive baissière douce = meilleure vente
    FAST_DOWN:      -4,
    EXPLOSIVE_DOWN: +3,   // flush : on ne vend pas
  },
  // Miroir d'EXTREME_UPPER.
  EXTREME_LOWER: {
    EXPLOSIVE_UP:   +2,   // on ne court pas après le rebond violent
    FAST_UP:        +7,
    SOFT_UP:       +10,   // ★ relâchement précoce depuis l'étirement max = meilleure entrée longue
    FLAT:           +3,   // ⭐ élastique tendu à l'envers : le rappel haussier arrive
    SOFT_DOWN:       0,
    FAST_DOWN:      +2,
    EXPLOSIVE_DOWN: +4,   // capitulation, on fade
  },
};

// ⭐ `FLAT` N'EST PAS NUL AUX EXTRÊMES (∓3) — VALIDÉ OWNER : « flat aux extrêmes annonce
//   retournement ». C'est LE seul écart à la convention du Cycle Expert, où `FLAT` vaut 0 partout,
//   et il est motivé par la mécanique propre au zscore : un z à +2,5σ qui cesse de bouger, c'est
//   l'élastique tendu qui ne va plus nulle part — la moyenne mobile, elle, continue de monter vers
//   le prix. L'immobilité RAPPROCHE donc le retournement au lieu de ne rien dire.
//   ⚠ Chez le %K la même case vaut 0 à juste titre : un oscillateur borné qui stagne à 95 ne subit
//   aucune force de rappel, il sature. Ne PAS « aligner » les deux par symétrie apparente — on
//   miroite ce qui DÉCRIT, on n'aligne pas ce qui MESURE.
//   Les deux cases sont miroirs l'une de l'autre : les repasser à 0 conserve l'invariant.

// ── AGRÉGATION MULTI-TF ────────────────────────────────────────────────────────────────────────
//   🔴 PROVISOIRE (owner : « garde les mêmes poids pour le moment, après on ajustera ») — ce sont
//   ceux du Cycle Expert, repris tels quels. Ils ne sont PAS déduits de la question du zscore :
//   un retour à la moyenne avec TP court se joue plus vite qu'une maturité de cycle, ce qui
//   plaiderait pour alourdir H1/M15. Constante de temps à trancher, pas un calibrage.
//   ⚠ Volontairement une constante SÉPARÉE de `CYCLE_TF_WEIGHTS`, pas un import : les deux
//   coïncident aujourd'hui par défaut, pas par nature. Les lier ferait bouger l'un avec l'autre.
export const ZSCORE_TF_WEIGHTS = { h1: 0.40, h4: 0.30, d1: 0.15, m15: 0.15 };

export const ZSCORE_MIN = -10;
export const ZSCORE_MAX = +10;

// Score d'UN timeframe. `null` = pas d'avis (jamais 0) : bande absente, Δz absent, ou combinaison
//   hors table. 0 reste une OPINION — c'est ce que dit FLAT dans le corps de la distribution.
export function zscoreExpertScore({ zBand, dZBand }) {
  if (zBand == null || dZBand == null) return null;
  const row = ZSCORE_TABLE[zBand];
  if (!row) return null;
  const s = row[dZBand];
  return Number.isFinite(s) ? s : null;
}

export const zscoreGlobal = (perTf) => weightedGlobal(perTf, ZSCORE_TF_WEIGHTS);

// Contrôle d'invariant — rend `[]` si les trois miroirs sont exacts.
export function zscoreMirrorCheck() {
  const T = ZSCORE_TABLE;
  return [
    { pair: "UPPER ↔ LOWER", bad: mirrorViolations(T.UPPER, T.LOWER) },
    { pair: "EXTREME_UPPER ↔ EXTREME_LOWER", bad: mirrorViolations(T.EXTREME_UPPER, T.EXTREME_LOWER) },
    { pair: "NEUTRAL ↔ NEUTRAL", bad: mirrorViolations(T.NEUTRAL, T.NEUTRAL) },
  ].filter((r) => r.bad.length);
}
