// _ghost_unripe.mjs — CE QUE COÛTE UN RELÈVEMENT DE `SCORE_MIN_EXH`, AVANT DE LE FAIRE.
//   Usage: npx vite-node stats/_ghost_unripe.mjs
//
// LA QUESTION (chantier n°5 de la liste du 03/08) : monter `SCORE_MIN_EXH` devait RENDRE des barres
//   à la continuation. Il n'en rend pas — un EXH qui repasse sous le seuil pose `exhRefused.kind =
//   "unripe"`, qui SUPPRIME le CONT de la barre. On la perd deux fois. 529 CONT ont disparu comme ça
//   au dernier relèvement, jamais mesurés séparément. C'est le préalable annoncé avant de monter
//   au-dessus de 1,8.
//
// DEUX CLASSES DE FANTÔMES, ET IL FAUT LES SÉPARER :
//   · `unripe` — l'EXH était DÉJÀ sous le seuil. Ces CONT sont perdus AUJOURD'HUI, à 1,8.
//   · `outbid` — l'EXH tire ENCORE et a gagné le concours. Bandés par leur `exhScore`, ils donnent
//     cran par cran ce qu'un relèvement supprimerait EN PLUS.
//
// ⚠⚠ COHORTE, PAS NET. Les fantômes ne prennent aucune place dans le carnet : ils ne déplacent aucun
//   trade réel. C'est délibéré — « les vetos ne soustraient pas, ils REMPLACENT », donc un « R/tr du
//   lot retiré » lu sur un diff de deux runs est un NET et ne répond pas à la question posée ici.
// ⚠ DÉDUPLICATION PAR ÉPISODE OBLIGATOIRE (convention dans `_episodes.mjs`) : sans carnet ni
//   espacement, la même configuration tire à chaque évaluation. Un WR par TIR ne veut rien dire ici.
import fs from "fs";
import path from "path";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
import { prepareAsset } from "../src/components/simulations/matrixBacktest.mjs";
// ⭐ Convention d'épisode partagée. ⚠ Ici la « thèse » de la clé est la CLASSE DE FANTÔME
//   (`unripe` / `outbid`) : ce sont deux populations distinctes, pas deux vues d'une même.
import { dedupeEpisodes, cohortStats } from "./_episodes.mjs";
import { SCORE_MIN_EXH } from "../../Matrix-Revolution/src/components/robot/engines/scoring/scoringDecision.js";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
const stat = cohortStats;
// 1er tir de chaque épisode — l'effectif honnête. Convention dans `_episodes.mjs`.
const episodes = (t) => dedupeEpisodes(t);

const all = [];
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostUnripe: true });
  const g = p.ghosts ?? [];
  if (!g.length) { console.log(`${asset.padEnd(12)} aucun fantôme (actif hors whitelist)`); continue; }
  for (const c of g) {
    const r = p.walk(c);
    // ⚠ `type: c.ghost` — la classe de fantôme TIENT LIEU DE THÈSE dans la clé d'épisode.
    if (r && typeof r.R === "number") all.push({ ...r, asset, ghost: c.ghost, type: c.ghost, side: c.side, ep: c.ep, exhScore: c.exhScore });
  }
  const u = episodes(all.filter((x) => x.asset === asset && x.ghost === "unripe"));
  const o = episodes(all.filter((x) => x.asset === asset && x.ghost === "outbid"));
  const su = stat(u), so = stat(o);
  console.log(`${asset.padEnd(12)} unripe ${String(su.n).padStart(4)} ép WR ${fmt(su.wr)} R/tr ${fmt(su.rt, 4)}  ·  outbid ${String(so.n).padStart(4)} ép WR ${fmt(so.wr)} R/tr ${fmt(so.rt, 4)}`);
}
function fmt(v, d = 2) { return Number.isFinite(v) ? v.toFixed(d).padStart(d === 2 ? 6 : 7) : "     —"; }

const uni = episodes(all.filter((x) => x.ghost === "unripe"));
const out = episodes(all.filter((x) => x.ghost === "outbid"));
const U = stat(uni), O = stat(out), Utir = stat(all.filter((x) => x.ghost === "unripe"));

console.log("\n" + "=".repeat(84));
console.log(`SEUIL COURANT : SCORE_MIN_EXH = ${SCORE_MIN_EXH}   ·   point mort 1:3 = 75,00 %   ·   moteur 81,1 % / 0,0832`);
console.log("=".repeat(84));
console.log(`  DÉJÀ PERDU (unripe)  : ${String(U.n).padStart(5)} ép · WR ${U.wr.toFixed(2)}% · R/tr ${U.rt.toFixed(4)} · R ${U.R.toFixed(1)}`);
console.log(`  ⚠ le même lot par TIR : ${Utir.n} tr · WR ${Utir.wr.toFixed(2)}% — gonflement ×${(Utir.n / Math.max(1, U.n)).toFixed(1)}`);
console.log(`  EN JEU (outbid)      : ${String(O.n).padStart(5)} ép · WR ${O.wr.toFixed(2)}% · R/tr ${O.rt.toFixed(4)} · R ${O.R.toFixed(1)}`);

// ── LE COÛT CRAN PAR CRAN — c'est la table qui décide, pas les agrégats ci-dessus ──
console.log("\n  CE QU'UN RELÈVEMENT SUPPRIMERAIT EN PLUS (cumulé depuis le seuil courant) :");
console.log("  " + "-".repeat(80));
console.log(`  ${"seuil".padEnd(8)} ${"ép. CONT tués".padStart(14)} ${"WR".padStart(8)} ${"R/tr".padStart(9)} ${"R perdu".padStart(9)}`);
console.log("  " + "-".repeat(80));
for (const T of [2.0, 2.2, 2.4, 2.6, 3.0, 3.5]) {
  const band = out.filter((x) => Math.abs(x.exhScore ?? 0) < T);
  const s = stat(band);
  console.log(`  ${String(T).padEnd(8)} ${String(s.n).padStart(14)} ${Number.isFinite(s.wr) ? s.wr.toFixed(2) + "%" : "—".padStart(8)} ${Number.isFinite(s.rt) ? s.rt.toFixed(4).padStart(9) : "—".padStart(9)} ${s.R.toFixed(1).padStart(9)}`);
}
console.log("  " + "-".repeat(80));
console.log("  Lecture : un lot AU-DESSUS du point mort est de l'argent qu'on jette en montant le seuil.");
console.log("  Il ne se compense QUE si l'EXH gagné ailleurs fait mieux — ce que ce script ne mesure pas.");
