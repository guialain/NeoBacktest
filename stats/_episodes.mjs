// ============================================================================================
// _episodes.mjs — LA CONVENTION D'ÉPISODE, EN UN SEUL ENDROIT.
//
// ⭐ POURQUOI UN MODULE ET PAS TROIS COPIES : cette convention décide de TOUS les effectifs, donc de
//   tous les σ, donc de tous les verdicts. Recopiée dans chaque sonde, elle diverge au premier
//   ajustement et deux mesures cessent d'être comparables sans que rien ne le signale — c'est le
//   motif `derived_dataset_computed_3x`, et il a déjà coûté une correction aujourd'hui.
//
// ── CE QU'EST UN ÉPISODE ─────────────────────────────────────────────────────────────────────
// Le moteur réévalue toutes les `cadenceMin` (2 min). Tant que la configuration tient, il retire sur
// le MÊME setup. Ces tirs sont des exécutions d'UNE décision, pas des observations indépendantes.
//   Un ÉPISODE = tous les tirs consécutifs de même ACTIF, même CÔTÉ, même THÈSE, séparés de moins de
//   `EPISODE_GAP_MIN` minutes. On garde le PREMIER tir — la décision telle qu'elle s'est produite.
//
// ── POURQUOI 15 MINUTES (owner 2026-08-03) ───────────────────────────────────────────────────
// ⚠ CE N'EST PAS LA DURÉE D'UN TRADE. Mesurée, elle vaut 128 min de MÉDIANE (p25 47 · p75 408 ·
//   p90 1 034) — les trades durent BEAUCOUP plus qu'un épisode, et confondre les deux mène à choisir
//   un seuil trop large.
// ⭐ La bonne distribution est l'ÉCART ENTRE DEUX TIRS CONSÉCUTIFS : médiane **10 min**, et **59,3 %
//   des écarts sont sous 15 min**. Une rafale de clones bat à ~10 min ; au-delà de 15 on n'agrège
//   plus une rafale, on en enchaîne plusieurs. 15 min est donc la respiration du SIGNAL.
// ⭐ Et c'est aussi le seuil le plus PUISSANT : 1 782 épisodes EXH contre 923 à 60 min, sans changer
//   aucun verdict (contraste 40/20 du score EXH : +0,2 σ à 15, −0,8 à 30, −0,7 à 60 — jamais
//   significatif à aucun seuil). Le paramètre ne porte pas la conclusion ; c'est le contrôle qui
//   autorise à le choisir sur un autre critère que le résultat.
//
// ── LA THÈSE EST DANS LA CLÉ, ET C'EST UN CORRECTIF ──────────────────────────────────────────
// ⚠ Sans elle, un tir CONT et un tir EXH du même actif/côté dans la fenêtre tombaient dans le même
//   épisode, et le filtrage par type ÉCARTAIT les tirs de la seconde thèse : mesuré, **10,8 % des
//   épisodes étaient mixtes et 587 tirs disparaissaient** des mesures ventilées par type. Deux thèses
//   sont deux décisions ; elles ne partagent pas un épisode.
//
// ⚠ QUAND NE PAS DÉDUPLIQUER : pour le P&L RÉEL du compte. Là chaque clone a ouvert une position et
//   payé un spread — le tir est alors la bonne unité. La déduplication sert à mesurer si un signal
//   DISCRIMINE, pas à mesurer ce que le compte gagne.
// ============================================================================================

/** Écart au-delà duquel un nouveau tir ouvre un nouvel épisode. */
export const EPISODE_GAP_MIN = 15;

/** Clé d'épisode. ⚠ La THÈSE en fait partie — cf. les 10,8 % d'épisodes mixtes ci-dessus. */
export const episodeKey = (asset, side, type) => `${asset}|${side}|${type}`;

/**
 * dedupeEpisodes — rend le PREMIER tir de chaque épisode.
 * ⚠ ATTEND DES TIRS TRIÉS PAR TEMPS À L'INTÉRIEUR DE CHAQUE CLÉ. `runMatrixBacktest` les rend déjà
 *   dans l'ordre pour un actif donné ; en multi-actifs, trier avant d'appeler. Un ordre cassé ne
 *   lève rien : il fabriquerait silencieusement des épisodes trop nombreux.
 * @param {Array} signals  tirs portant { ep, side, type } + un `asset` (ou passé via `getAsset`)
 * @param {(s:any)=>string} [getAsset]  extracteur d'actif (défaut : `s.asset`)
 * @param {number} [gapMin]  surcharge du seuil — RÉSERVÉ aux tests de sensibilité.
 * @returns {Array} le premier tir de chaque épisode, dans l'ordre d'apparition
 */
export function dedupeEpisodes(signals, getAsset = (s) => s.asset, gapMin = EPISODE_GAP_MIN) {
  const last = {}, out = [];
  for (const s of signals) {
    const k = episodeKey(getAsset(s), s.side, s.type);
    if (last[k] == null || (s.ep - last[k]) > gapMin) out.push(s);
    last[k] = s.ep;                       // l'horloge se relance à CHAQUE tir : c'est un ÉCART, pas une fenêtre
  }
  return out;
}

/** WR, point mort effectif, marge et σ d'une cohorte. Le verdict vient de σ, jamais de la marge. */
export function cohortStats(t) {
  const w = t.filter((x) => x.outcome === "WIN").length, l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  const tp = t.filter((x) => x.reason === "TP");
  const rtp = tp.length ? tp.reduce((s, x) => s + x.R, 0) / tp.length : NaN;
  const be = Number.isFinite(rtp) ? 100 / (1 + rtp) : NaN;   // point mort EFFECTIF, pas supposé
  const N = w + l, wr = N ? 100 * w / N : NaN, p = wr / 100;
  const se = N ? 100 * Math.sqrt(p * (1 - p) / N) : NaN;
  return { n: t.length, wr, be, marge: wr - be, se, sig: se ? (wr - be) / se : NaN,
           rt: t.length ? R / t.length : NaN, R };
}
