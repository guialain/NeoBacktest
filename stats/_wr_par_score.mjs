// _wr_par_score.mjs — LE SCORE TRIE-T-IL ? WR par quintile de |score|, EXH et CONT séparés.
//   Usage: npx vite-node stats/_wr_par_score.mjs
//
// ⭐ LA QUESTION EST CELLE DU SEUIL : `MIN_EXH` / `MIN_CONT` ne valent quelque chose que
//   si le score CLASSE. Un seuil posé sur un score qui ne trie pas n'est pas un filtre, c'est un
//   échantillonneur aléatoire — il retire une fraction de la population au hasard.
//
// ⚠ QUINTILES DE LA POPULATION, PAS DES BORNES POSÉES À LA MAIN. Découper une variable continue
//   avant d'avoir regardé sa distribution, c'est décider d'avance où l'on ne verra rien : c'est
//   comme ça qu'une queue à n=2 avait fait conclure « pas d'effet » sur le gap K/D. Ici chaque case
//   a un effectif comparable par construction.
//
// ⭐⭐ DEUX COLONNES POUR L'EXH, ET C'EST TOUT L'INTÉRÊT : `exhRaw` (les six experts seuls) et `exh`
//   (après bonus). Le bonus M15 câblé le 03/08 vaut +5 sur un |score| médian de 2,59 — s'il domine,
//   la colonne bonifiée trierait très bien tout en ne disant plus rien des experts. Les séparer est
//   la seule façon de savoir LEQUEL des deux classe.
//
// ⚠ Tout est compté en ÉPISODES — définition et seuil dans `_episodes.mjs` (actif | côté | THÈSE,
//   écart > 15 min). Un WR par TIR est gonflé et surtout BIAISÉ vers les épisodes gagnants.
// ⚠ Le repère est le POINT MORT de la cohorte, pas zéro. Et le verdict vient de σ, pas de la marge.
import fs from "fs";
import path from "path";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
import { MIN_EXH, MIN_CONT } from "../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";
// ⭐ LA CONVENTION D'ÉPISODE ET LES STATS DE COHORTE VIENNENT DU MODULE, pas d'une copie locale :
//   elles décident de tous les effectifs, donc de tous les σ, donc de tous les verdicts.
import { dedupeEpisodes, cohortStats, EPISODE_GAP_MIN } from "./_episodes.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const all = [];
for (const f of fs.readdirSync(MATRIX).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const r = runMatrixBacktest(path.join(MATRIX, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) {
    if (typeof s.R !== "number") continue;
    all.push({ R: s.R, outcome: s.outcome, reason: s.reason, type: s.type, side: s.side, ep: s.ep, asset: r.asset,
               exh: s.sc?.exh, exhRaw: s.sc?.exhRaw, cont: s.sc?.cont, contRaw: s.sc?.contRaw });
  }
}
const E = dedupeEpisodes(all);
const st = cohortStats;

function table(label, pop, key, seuil) {
  const t = pop.filter((x) => Number.isFinite(x[key])).map((x) => ({ ...x, v: Math.abs(x[key]) }));
  if (t.length < 20) { console.log(`\n${label} — effectif insuffisant (${t.length})`); return; }
  const srt = [...t].sort((a, b) => a.v - b.v);
  const cuts = [1, 2, 3, 4].map((i) => srt[Math.floor(i * srt.length / 5)].v);
  const bands = [];
  for (let i = 0; i < 5; i++) {
    const lo = i === 0 ? -Infinity : cuts[i - 1], hi = i === 4 ? Infinity : cuts[i];
    bands.push({ lo, hi, t: t.filter((x) => x.v >= lo && x.v < hi) });
  }
  console.log(`\n${label}   (seuil moteur = ${seuil} · n=${t.length} épisodes)`);
  console.log(`  ${"quintile de |score|".padEnd(24)} ${"n".padStart(4)} ${"WR".padStart(7)} ${"marge".padStart(7)} ${"σ".padStart(6)} ${"R/tr".padStart(8)}`);
  const rows = bands.map((b, i) => {
    const s = st(b.t);
    const rg = `Q${i + 1}  ${b.lo === -Infinity ? "  <" : b.lo.toFixed(2)}${b.lo === -Infinity ? "" : "–"}${b.hi === Infinity ? "+" : b.hi.toFixed(2)}`;
    console.log(`  ${rg.padEnd(24)} ${String(s.n).padStart(4)} ${s.wr.toFixed(2).padStart(7)} ${s.marge.toFixed(2).padStart(7)} ${(s.sig >= 0 ? "+" : "") + s.sig.toFixed(1).padStart(5)} ${s.rt.toFixed(4).padStart(8)}`);
    return s;
  });
  // ⭐ LE VERDICT : l'écart Q5−Q1 rapporté à SON erreur-type. Une suite de cases qui montent « à
  //   l'œil » sur cinq points bruités ne prouve rien ; c'est cet écart-là qui décide.
  const q1 = rows[0], q5 = rows[4];
  const se = Math.sqrt(q1.se ** 2 + q5.se ** 2);
  const d = q5.wr - q1.wr, sig = se > 0 ? d / se : NaN;
  const mono = rows.every((r, i) => i === 0 || r.wr >= rows[i - 1].wr - 1e-9);
  console.log(`  ⇒ Q5 − Q1 = ${d.toFixed(2)} pt de WR · ${sig.toFixed(1)} σ · ${Math.abs(sig) < 2 ? "NE TRIE PAS (<2σ)" : d > 0 ? "TRIE" : "TRIE À L'ENVERS"}${mono ? " · monotone" : " · NON monotone"}`);
}

console.log(`\n${E.length} épisodes · ${E.filter((x) => x.type === "EXHAUSTION").length} EXH · ${E.filter((x) => x.type === "CONTINUATION").length} CONT`);
const EXH = E.filter((x) => x.type === "EXHAUSTION"), CONT = E.filter((x) => x.type === "CONTINUATION");
table("EXH · score BONIFIÉ (celui qui décide)", EXH, "exh", MIN_EXH);
table("EXH · score BRUT (les six experts seuls)", EXH, "exhRaw", MIN_EXH);
table("CONT · score BONIFIÉ (celui qui décide)", CONT, "cont", MIN_CONT);
table("CONT · score BRUT", CONT, "contRaw", MIN_CONT);
// ══ RÉCONCILIATION AVEC LE « 5,7 ET » DU 02/08 ═══════════════════════════════════════════════════
// ⭐⭐ LA MÊME MESURE SANS DÉDUPLICATION, pour savoir si l'écart entre les deux verdicts est un
//   changement de MOTEUR ou un changement de COMPTAGE. σ croît en √n : dédupliquer divise l'effectif
//   par le facteur de clonage, donc un effet réel FAIBLE devient non significatif, et un effet nul
//   comptabilisé sur les clones peut paraître écrasant. Il faut voir les deux nombres côte à côte.
console.log("\n" + "=".repeat(72));
console.log("MÊME MESURE, SANS DÉDUPLICATION — pourquoi le 02/08 lisait « 5,7 ET »");
console.log("=".repeat(72));
const EXHt = all.filter((x) => x.type === "EXHAUSTION");
console.log(`  tirs ${EXHt.length} · épisodes ${EXH.length} · facteur de clonage ×${(EXHt.length / EXH.length).toFixed(1)}`);
table("EXH · score BRUT — PAR TIR (clones comptés comme indépendants)", EXHt, "exhRaw", MIN_EXH);
console.log("\n  ⚠⚠ Si le verdict bascule entre les deux tableaux, ce n'est PAS le moteur qui a changé :");
console.log("     c'est que compter les clones comme indépendants FABRIQUE de la significativité.");

console.log("\n  ⚠ Population CENSURÉE : on ne voit que les barres qui ont TIRÉ. Ce que le score fait");
console.log("    sous le seuil est invisible ici — un score peut très bien trier au-dessus et pas en dessous.");
