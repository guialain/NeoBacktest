// _slope_cells_ghost.mjs — LE BAREME `slope` SE TIENT-IL, CASE PAR CASE ?
//   Usage: node stats/_slope_cells_ghost.mjs
//
// LA QUESTION (owner 2026-08-05) : sur le cas NOMINAL — fade SELL x pente POSITIVE, donc la table
//   `SLOPE_EXH_SELL` employee comme elle a ete ecrite — la cohorte des TIRS fait 72,8 % pour -6,4 R.
//   « Ca veut dire que les valeurs ne sont pas correctes pour pente positive, non ? »
//
// ⚠⚠ POURQUOI LES TIRS NE PEUVENT PAS REPONDRE, ET C'EST TOUT L'OBJET DE CETTE SONDE. Un tir existe
//   parce que `|somme ponderee| >= MIN_EXH`. Conditionner sur une SOMME anti-correle ses termes :
//   une barre retenue AVEC un `slope` fort a les autres experts plus faibles, sinon elle serait
//   passee de toute facon. C'est un COLLIDER, il est MESURE dans ce depot (les experts EXH ont une
//   correlation negative avec la somme des autres dans les tirs, `slope` a -0,44 — la PIRE des huit).
//   ⇒ Sur les tirs, la case la mieux notee DOIT paraitre moins bonne. Le motif observe est
//   exactement celui que le biais predit : on ne peut pas en conclure que le bareme a tort.
// ⭐ `ghostAllExh` rend TOUTES les barres ou la these de fade a un avis, tirees ou non. Population
//   NON conditionnee : c'est la seule ou la question « cette case vaut-elle ce qu'on lui donne ? »
//   ait un sens.
//
// ⚠ COHORTE, PAS NET : les fantomes ne prennent aucune place au carnet, ils ne deplacent aucun trade.
// ⚠ DEDUPLICATION PAR EPISODE obligatoire — sans carnet ni espacement, la meme configuration tire a
//   chaque evaluation et un WR par TIR ne veut rien dire.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { prepareAsset, loadCsvRows } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes, cohortStats } from "./_episodes.mjs";
import { slopeLevel4, slopeDeltaCol } from "../../Matrix-Revolution/src/components/robot/engines/config/SlopeConfig.js";
import { SLOPE_EXH_SELL, SLOPE_EXH_BUY } from "../../Matrix-Revolution/src/components/robot/engines/scoring/exhaustionScorer.js";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const all = [];
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllExh: true });
  // ⚠ `prepareAsset` NE REND PAS `rows` — on les relit. `ghost.i` est l'index dans CETTE liste,
  //   donc les deux lectures doivent etre la meme fonction, pas deux parseurs.
  const rows = loadCsvRows(path.join(MATRIX, f));
  for (const c of p.ghosts ?? []) {
    const r = p.walk(c);
    if (!r || typeof r.R !== "number") continue;
    const row = rows[c.i];
    const close = num(row?.slope_h1), live = num(row?.slope_h1_s0);
    if (close == null || live == null || live === 0) continue;
    const lvl = slopeLevel4(close, asset);
    if (!lvl) continue;
    const col = slopeDeltaCol(+(live - close).toFixed(4), lvl, asset);
    if (!col) continue;
    // La TABLE employee est choisie par le signe de la pente LIVE, pas par le cote du fade.
    const tbl = live > 0 ? "SELL" : "BUY";
    const val = (live > 0 ? SLOPE_EXH_SELL : SLOPE_EXH_BUY)[lvl]?.[col];
    all.push({ ...r, asset, side: c.side, type: "exh-all", ep: c.ep, lvl, col, tbl, val, fired: c.fired });
  }
  process.stderr.write(`${asset} `);
}
process.stderr.write("\n");

const ep = dedupeEpisodes(all, (s) => s.asset);
const st = (x) => cohortStats(x);
const line = (lbl, x) => {
  if (!x.length) return;
  const c = st(x);
  console.log(`  ${lbl.padEnd(30)} n=${String(c.n).padStart(5)}  WR ${c.wr.toFixed(2).padStart(6)}%  marge ${c.marge.toFixed(2).padStart(7)}  ${c.sig.toFixed(1).padStart(5)} sig  R/ep ${c.rt.toFixed(4).padStart(8)}`);
};

console.log(`\nPOPULATION NON SELECTIONNEE — ${ep.length} episodes (dont ${ep.filter((x) => x.fired).length} ont tire)\n`);
line("TOUT", ep);

console.log("\n=== TABLE SELL (pentes POSITIVES) — la case dictee vs ce qu'elle rend ===");
console.log("  case                            n      WR      marge    sigma    R/ep      valeur du bareme");
for (const lvl of ["flat", "weak", "strong", "extreme"]) {
  for (const col of ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"]) {
    const g = ep.filter((x) => x.tbl === "SELL" && x.lvl === lvl && x.col === col);
    if (g.length < 20) continue;
    const c = st(g);
    console.log(`  ${(lvl + " x " + col).padEnd(30)} ${String(c.n).padStart(5)}  ${c.wr.toFixed(2).padStart(6)}%  ${c.marge.toFixed(2).padStart(7)}  ${c.sig.toFixed(1).padStart(5)}  ${c.rt.toFixed(4).padStart(8)}      ${String(SLOPE_EXH_SELL[lvl][col]).padStart(4)}`);
  }
}
console.log("\n=== et par VALEUR dictee (table SELL) — le bareme ORDONNE-t-il ? ===");
const byv = {};
for (const x of ep.filter((y) => y.tbl === "SELL")) (byv[x.val] ??= []).push(x);
for (const k of Object.keys(byv).map(Number).sort((a, b) => a - b)) line(`valeur ${k > 0 ? "+" : ""}${k}`, byv[k]);
