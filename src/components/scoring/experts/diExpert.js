// diExpert.js — DI EXPERT (owner 2026-07-26). Remplace le Pressure/ADX dans la table de scoring.
// --------------------------------------------------------------------------------------------
// LA QUESTION : **qui tient le marché, et sa prise se resserre-t-elle ou se relâche-t-elle ?**
//   Seul capteur de la famille ADX qui porte LE CAMP, et pas une magnitude.
//
// DEUX ENTRÉES → 21 cases
//   • `diGapBand`      QUI mène et avec QUELLE SOLIDITÉ — 7 bandes signées, coupures 5,5 · 10 · 23,
//     calibrées sur le COMPORTEMENT et non sur la population.
//     ⭐ OWNER : « ce sont les extrêmes et high qui nous intéressent — quand le marché n'a pas de
//     direction claire, les DI se recoupent tout le temps. » Mesuré, il a raison. Le camp qui mène
//     mène-t-il encore 6 bougies plus tard (H1, n=6 733) :
//         |écart| < 5,5   52 %   ← pile ou face, aucune direction exploitable
//                 5,5-10  59 %   WEAK
//                 10-23   66 %   SOLID
//                 ≥ 23    76 %   STRONG        (et ≥ 30 : 82 %)
//     ⭐ L'ancien schéma 5-30-30-30-5 équilibrait les POPULATIONS mais mélangeait les régimes : sa
//     bande BUY couvrait 5,5→23, soit du 59 % avec du 68 %. Le découpage comportemental la scinde.
//     ℹ️ Ces coupures tombent près des quantiles p30/p50/p90 de |écart| — fondées statistiquement aussi.
//   • `diGapDynamics`  la prise se resserre-t-elle — NARROWING · STABLE · WIDENING
//
// ⚠ BANDE lue en LIVE (`_s0`), DYNAMIQUE lue sur les CLOSES (c1 vs c2). Ce n'est pas une
//   incohérence : un NIVEAU est un ÉTAT et gagne à être frais, une DYNAMIQUE est un ÉVÉNEMENT et
//   exige des bougies COMPARABLES — le principe déjà posé pour `dominanceTurn`.
//   🔴 Mesuré : lue en LIVE, la dynamique est muette 65 % du temps. Quand la bougie n'a pas étendu
//   son range, les deux DI décroissent du même facteur, l'écart aussi, et le delta corrigé vaut
//   EXACTEMENT zéro. La bande morte n'y change rien : à 0,05 comme à 0,85 le partage est identique.
//
// ⚠⚠ PERSISTANCE ≠ RENDEMENT. `SOLID` tient à 66 % mais ne rapporte que +0,055 % à 6 bougies, et la
//   tranche 15-23 tient à 68 % pour +0,020 % à 47 % de favorable. **Les DI décrivent QUI domine,
//   pas COMBIEN ça paye.** Ne pas lire la persistance comme un edge.
//
// 🔴 CE BARÈME EST DE LA CONNAISSANCE OWNER, PAS UNE MESURE. Une validation case par case contre le
//   prix a été tentée et n'a rien tranché — 49-50 % de favorable sur l'ensemble.
//   ⭐🔥 OWNER : tester les paramètres SÉPARÉMENT donne toujours 50-50, parce que la mesure isolée
//   mélange tous les régimes, tous les actifs, toutes les sessions. Ce qui a du sens, c'est de tester
//   la CONJONCTION une fois l'archi en place, puis de reprendre la condition qui revient dans les
//   pertes. ⚠ En le faisant, comparer la part d'une condition dans les PERTES à sa part dans
//   l'ENSEMBLE — sinon on retravaille la condition la plus FRÉQUENTE, pas la plus FAUTIVE.
//
// ℹ️ Seul appui mesuré ayant survécu au nettoyage des données : `WIDENING` dans les bandes
//   directionnelles tient des DEUX côtés (52 % et 55 % à 6 bougies, n≈400 chacune).
import { weightedGlobal } from "./aggregate.js";

// ── LA TABLE — miroir exact ; la dynamique n'étant pas directionnelle, le miroir est une négation.
//   Fréquences mesurées en commentaire (H1+M15, n=32 389).
export const DI_TABLE = {
  STRONG_BUY:  { NARROWING: -10, STABLE: +5, WIDENING:  +8 },       // 0,8 · 0,7 · 2,6 %   (4,0 %)
  SOLID_BUY:   { NARROWING:  -8, STABLE: +8, WIDENING: +10 },       // 5,5 · 4,2 · 9,3 %  (19,0 %)
  WEAK_BUY:    { NARROWING:  -5, STABLE: +5, WIDENING: +10 },       // 3,4 · 3,6 · 4,4 %  (11,5 %)
  BALANCED:    { NARROWING:  -5, STABLE:  0, WIDENING:  +5 },       // 15,0 · 12,5 · 4,4 % (31,8 %)
  WEAK_SELL:   { NARROWING:  +5, STABLE: -5, WIDENING: -10 },       // 3,7 · 3,7 · 4,3 %  (11,6 %)
  SOLID_SELL:  { NARROWING:  +8, STABLE: -8, WIDENING: -10 },       // 5,5 · 3,9 · 9,0 %  (18,4 %)
  STRONG_SELL: { NARROWING: +10, STABLE: -5, WIDENING:  -8 },       // 0,7 · 0,6 · 2,3 %   (3,6 %)
};

// ⚠ ÉCHELLE PLEINE ±10 (owner 2026-07-26) — ex ±8. Motif : le DI Expert est désormais le SEUL
//   représentant de la famille ADX/DI dans le scoring, le Pressure/ADX ayant été débranché. Il n'a
//   plus de raison d'être compressé et doit occuper la même amplitude que le Cycle et le ZScore,
//   sans quoi son avis pèserait structurellement moins dans toute lecture globale.
//   Reclassement appliqué uniformément : 3 → 5 · 5 → 8 · 8 → 10 (le 0 de BALANCED reste 0).

// ── LES DEUX RÈGLES QUE LA TABLE ENCODE (owner) ───────────────────────────────────────────────
// ⭐🔥 1. LE RESSERREMENT INVERSE TOUJOURS LE SENS, ET D'AUTANT PLUS FORT QUE LA PRISE EST SOLIDE.
//   `NARROWING` vaut −3 · −5 · −8 en montant de `WEAK` à `STRONG`. Ce n'est pas « les extrêmes sont
//   contrarian » — c'est plus fin : **plus la domination est établie, plus son relâchement compte**.
//   Un écart faible qui se referme n'est qu'un bruit de plus ; un écart écrasant qui se referme est
//   un basculement.
// ⭐🔥 2. L'ÉCARTEMENT SUIT LE LEADER, MAIS RETOMBE AU SOMMET.
//   `WIDENING` vaut +8 · +8 · **+5** : il PLAFONNE en `WEAK`/`SOLID` puis REDESCEND en `STRONG`.
//   La logique n'est pas contrarian, elle est de PLACE RESTANTE — un écart déjà écrasant qui
//   s'écarte encore a moins de chemin devant lui. C'est le seul écho de « on n'achète pas
//   l'euphorie », appliqué à la CONVICTION et non au SIGNE.
// ⚠ Chaque ligne a donc un CREUX à gauche et un PLATEAU à droite, jamais une pente monotone.
// ⚠ `BALANCED` est renseigné (−3 · 0 · +3) et non `null` : même sans camp établi, un écart qui
//   s'ouvre ou se referme oriente faiblement. Le `0` central est une OPINION (« aucun penchant »),
//   assumée — c'est le seul zéro de la table.

// ⚠ `BALANCED` doit être ORIENTÉ par le signe du petit écart (cf. `diScore`) — la bande le déclare
//   non significatif, mais il est parfaitement équilibré (50,4 % positif) donc utilisable. Elle pèse
//   31,8 % : ce qu'on y met décide si l'expert parle ou se tait un tiers du temps.

// H1 principal, M15 pour la réactivité — les DI ne sont exportés que sur ces deux TF.
export const DI_TF_WEIGHTS = { h1: 0.65, m15: 0.35 };
export const DI_MIN = -10;
export const DI_MAX = +10;

// Score d'UN timeframe. `null` = pas d'avis (jamais 0) : capteur absent, ou case `null` du barème.
//   `gap` (l'écart signé) n'est lu QUE dans `BALANCED`, pour orienter — ailleurs la bande suffit.
export function diScore({ gapBand, gapDyn, gap }) {
  if (gapBand == null || gapDyn == null) return null;
  const row = DI_TABLE[gapBand];
  if (!row) return null;
  const s = row[gapDyn];
  if (!Number.isFinite(s)) return null;
  if (gapBand !== "BALANCED") return s;
  if (gap == null || gap === 0) return null;   // pas de signe à donner ⇒ pas d'avis
  return gap > 0 ? s : -s;
}

export const diGlobal = (perTf) => weightedGlobal(perTf, DI_TF_WEIGHTS);

// Contrôle d'invariant — la dynamique n'étant pas directionnelle, le miroir est une négation pure.
//   Rend `[]` si chaque bande SELL vaut exactement l'opposé de sa jumelle BUY, case par case.
export function diMirrorCheck() {
  const bad = [];
  for (const [a, b] of [["WEAK_BUY", "WEAK_SELL"], ["SOLID_BUY", "SOLID_SELL"], ["STRONG_BUY", "STRONG_SELL"]]) {
    for (const d of ["NARROWING", "STABLE", "WIDENING"]) {
      const want = DI_TABLE[a][d] == null ? null : -DI_TABLE[a][d];
      if (DI_TABLE[b][d] !== want) bad.push({ pair: `${a}↔${b}`, dyn: d, got: DI_TABLE[b][d], want });
    }
  }
  return bad;
}
