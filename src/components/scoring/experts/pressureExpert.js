// pressureExpert.js — PRESSURE EXPERT (ADX), barème v1 (owner 2026-07-26).
// --------------------------------------------------------------------------------------------
// MODULE NEUF, VOLONTAIREMENT SÉPARÉ de `scoringScales.js` (owner) : les classificateurs bandés
//   génériques et les experts de scoring ne se mélangent pas. Un expert = un fichier, sa table et
//   rien d'autre.
//
// CE QU'IL FAIT / CE QU'IL NE FAIT PAS
//   L'ADX mesure la pression directionnelle, RIEN D'AUTRE. Cet expert ne décide ni CONT, ni WAIT,
//   ni EXH : il rend un `PressureScore` borné [−10, +10]. La décision est ailleurs.
//
// TROIS ENTRÉES
//   • IC            `intraday_change` = (bid − open du jour) / open du jour × 100. UNE seule valeur
//                   pour l'actif — ce n'est pas une grandeur par TF. Elle donne le SENS ; la table
//                   IC<0 est le MIROIR EXACT de la table IC>0 (vérifié case par case).
//   • ADX level     `adxLevelBand` (moteur) — 5 bandes [16 · 24 · 33 · 55].
//   • dominanceTurn `adxTurnBand` (moteur) — RISING · TURN_UP · FLAT · TURN_DOWN · FALLING,
//                   sur les CLOSES (delta1 = c1−c2, delta2 = c2−c3), bande morte 1,0.
//
// ⚠ NOMMAGE : l'owner écrit « EXTREME » pour la bande haute ; le moteur la nomme `EXTREME_HIGH`
//   (depuis le recoupage 5 bandes miroir du 25/07, où `EXTREME_LOW` est apparu en face). La table
//   ci-dessous emploie les noms DU MOTEUR — c'est lui qui produit la valeur.
//
// ⭐ `TURN_DOWN` EN BANDE BASSE — complété par l'owner (2026-07-26), les deux cases manquaient.
//   « TURN_DOWN en EXTREME_LOW annonce un changement de tendance PROCHE » : en zone de compression
//   le mouvement en cours est sur le point de céder, donc le score va CONTRE le sens de l'IC.
//   Valeur −5 dans les deux bandes basses, alignée sur `FALLING` : ici l'AMORCE vaut la
//   PERSISTANCE. C'est la même entorse que `TURN_UP = RISING = +10` en `EXTREME_LOW` — dans les
//   bandes basses on ne divise pas l'amorce par deux, contrairement à `HIGH` où l'échelle est une
//   règle parfaitement symétrique (+10/+5/0/−5/−10).
import { weightedGlobal } from "./aggregate.js";

// ── LA TABLE, CAS IC > 0 ───────────────────────────────────────────────────────────────────────
//   Lecture : PRESSURE_TABLE[bande ADX][dominanceTurn] → score.
//   Le cas IC < 0 s'obtient par NÉGATION (miroir) — voir `pressureScore`. On ne duplique pas la
//   table : deux tables jumelles finissent toujours par diverger d'une case.
export const PRESSURE_TABLE = {
  // Après une forte compression, la pression renaît. Zone de NAISSANCE de tendance.
  EXTREME_LOW:  { RISING: +10, TURN_UP: +10, FLAT: 0, TURN_DOWN:   -5, FALLING:  -5 },
  // La pression commence à se construire.
  LOW:          { RISING: +10, TURN_UP:  +5, FLAT: 0, TURN_DOWN:   -5, FALLING:  -5 },
  // Pression intermédiaire — aucune information exploitable, quel que soit l'état.
  MEDIUM:       { RISING:   0, TURN_UP:   0, FLAT: 0, TURN_DOWN:    0, FALLING:   0 },
  // La pression est installée. Zone optimale de développement.
  HIGH:         { RISING: +10, TURN_UP:  +5, FLAT: 0, TURN_DOWN:   -5, FALLING: -10 },
  // Pression maximale : poursuivre n'informe plus, toute perte de pression est un fort signal
  //   d'essoufflement — d'où l'asymétrie voulue (+5 en haut, −10 en bas).
  EXTREME_HIGH: { RISING:  +5, TURN_UP:   0, FLAT: 0, TURN_DOWN:  -10, FALLING: -10 },
};

// ── AGRÉGATION MULTI-TF ────────────────────────────────────────────────────────────────────────
//   H1 est le TF de RÉFÉRENCE, M15 n'apporte que la RÉACTIVITÉ.
//   ⚠ L'ADX n'est exporté qu'en H1 et M15 — la question du D1/H4 ne se pose donc pas ici.
export const PRESSURE_TF_WEIGHTS = { h1: 0.65, m15: 0.35 };

export const PRESSURE_MIN = -10;
export const PRESSURE_MAX = +10;

// ⭐🔥 PORTE `BALANCED` — L'ÉCART DES DI ANNULE LE SCORE (owner 2026-07-26).
//   « DI+ et DI− trop proches ne donnent pas d'info directionnelle » : quand `diGapBand` vaut
//   `BALANCED` (|DI+−DI−| < 5,5 ⇒ **30 % des barres**), l'ADX ne mesure plus une pression exploitable
//   et son score tombe à 0. Le trou visé est chiffré : en bande ADX `HIGH`, 8,5 % des barres ont les
//   DI à moins de 4,5 points et recevaient pourtant jusqu'à ±10.
//   ⚠ ZÉRO ET NON `null`, ET C'EST VOULU : `BALANCED` est une CONSTATATION (« on a regardé, aucun
//   camp ne mène »), pas une absence de donnée. Un `null` ferait renormaliser l'agrégat et laisserait
//   l'autre TF décider seul ; un 0 dit « ce TF n'a rien à dire » et pèse son poids. C'est la lecture
//   littérale d'« annule le score ». Passer à `null` change l'agrégation, pas seulement l'affichage.
//   ℹ️ `gapBand` absent (DI non exportés) ⇒ la porte ne s'applique pas : on ne bloque pas sur une
//   donnée manquante, mais le cas ne se présente pas — sans DI il n'y a pas d'ADX non plus.
//
// Score d'UN timeframe. `null` = pas d'avis (et jamais 0) dans TOUS les cas d'absence :
//   IC manquant, IC exactement nul (le miroir n'a alors pas de sens à orienter), ADX absent
//   (D1/H4), dominanceTurn absent (il faut 3 closes), ou case non spécifiée au barème.
export function pressureScore({ ic, adxBand, turn, gapBand }) {
  if (ic == null || !Number.isFinite(ic) || ic === 0) return null;
  if (adxBand == null || turn == null) return null;
  const row = PRESSURE_TABLE[adxBand];
  if (!row) return null;
  const s = row[turn];
  if (!Number.isFinite(s)) return null;      // case `null` du barème → pas d'avis
  if (gapBand === "BALANCED") return 0;      // porte : aucun camp ne mène → l'ADX ne dit rien
  return ic > 0 ? s : -s;                    // IC < 0 = miroir exact
}

// Score global pondéré — règle d'agrégation PARTAGÉE (cf. `aggregate.js`), y compris la
//   renormalisation sur les TF réellement présents : si M15 manque, H1 vaut le score entier plutôt
//   que 65 % de lui-même, car un TF absent ne doit pas peser comme un TF à 0.
export const pressureGlobal = (perTf) => weightedGlobal(perTf, PRESSURE_TF_WEIGHTS);
