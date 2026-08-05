// _slope_solo.mjs — `slope` EST-IL UN SIGNAL, TOUT SEUL ?
//   Usage: node stats/_slope_solo.mjs
//
// LA QUESTION (owner 2026-08-05) : « on suppose qu'il est le seul observable et on teste ».
//   On retire donc TOUT ce qui n'est pas lui — les quatre autres experts, le seuil, les vetos,
//   l'admission, le carnet, l'espacement — et on lui fait choisir le cote et porter la conviction :
//       cote      = signe du score `slope` (axe absolu : + = interet LONG => fade BUY)
//       conviction= |score|
//   Puis on marche le trade au TP/SL de l'actif et on compte par EPISODE.
//
// ⭐ CE QUE CA REPOND, ET QUE RIEN D'AUTRE NE REPOND : les mesures precedentes lisaient `slope`
//   DANS une somme ponderee ou il pese 12,5 %, sur une population selectionnee par cette somme.
//   Deux ecrans entre le capteur et le resultat. Ici il n'y en a aucun.
// ⭐⭐ ET LE TEST EST DUR, C'EST VOULU : un expert cense TRIER doit au moins battre le hasard quand
//   on le laisse seul. S'il n'ordonne pas ici, il n'ordonnera pas mieux noye dans quatre autres.
//
// ⚠⚠ CE QUE CE N'EST PAS : une simulation de moteur. Pas d'admission, pas de veto, pas de seuil,
//   pas de spacing, pas de cap — donc les R ne se comparent A AUCUN chiffre publie du depot. C'est
//   une COHORTE de capteur, pas un backtest.
// ⚠ POPULATION : les barres ou la these de fade a un avis (`ghostAllExh`). C'est un conditionnement
//   LEGER — il ne depend pas du seuil ni de `slope` — mais il n'est pas nul : les barres ou les
//   CINQ experts se taisent n'y sont pas. Dit plutot que tu.
// ⚠ Le TP/SL est celui de l'actif, donc le point mort effectif se lit dans `cohortStats`, pas
//   suppose a 75 %.
import fs from "fs";
import path from "path";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
import { prepareAsset, loadCsvRows } from "../src/components/simulations/matrixBacktest.mjs";
import { dedupeEpisodes, cohortStats } from "./_episodes.mjs";
import { slopeLevel4, slopeDeltaCol } from "../../Matrix-Revolution/src/components/robot/engines/config/SlopeConfig.js";
import { SLOPE_EXH_SELL, SLOPE_EXH_BUY } from "../../Matrix-Revolution/src/components/robot/engines/scoring/exhaustionScorer.js";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const solo = [];   // le trade que `slope` aurait pris, seul
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  // ⚠ SPREAD FACTURE (2026-08-05) — sans lui la sonde flattait le capteur : le peage est paye a
  //   CHAQUE trade, et un expert qui gagne 1,3 point de marge hors spread peut en perdre autant une
  //   fois le remplissage reel applique. Un test de capteur qui ne paie pas ce que le capteur ferait
  //   payer ne repond pas a la question posee.
  const p = prepareAsset(path.join(MATRIX, f), { ghostAllExh: true, chargeSpread: true });
  const rows = loadCsvRows(path.join(MATRIX, f));
  for (const c of p.ghosts ?? []) {
    const row = rows[c.i];
    const close = num(row?.slope_h1), live = num(row?.slope_h1_s0);
    if (close == null || live == null || live === 0) continue;
    const lvl = slopeLevel4(close, asset); if (!lvl) continue;
    const col = slopeDeltaCol(+(live - close).toFixed(4), lvl, asset); if (!col) continue;
    const val = (live > 0 ? SLOPE_EXH_SELL : SLOPE_EXH_BUY)[lvl]?.[col];
    if (!Number.isFinite(val) || val === 0) continue;
    // ⭐ LE COTE VIENT DE `slope` ET DE LUI SEUL. `+` = interet long => on prend le fade ACHETEUR.
    const side = val > 0 ? "BUY" : "SELL";
    const r = p.walk({ ...c, side });
    if (!r || typeof r.R !== "number") continue;
    solo.push({ ...r, asset, side, ep: c.ep, type: "slope-solo", lvl, col, val, mag: Math.abs(val),
                tbl: live > 0 ? "SELL" : "BUY", agree: side === c.side });
  }
  process.stderr.write(`${asset} `);
}
process.stderr.write("\n");

const ep = dedupeEpisodes(solo, (s) => s.asset);
const L = (lbl, x) => {
  if (!x.length) return console.log(`  ${lbl.padEnd(28)} —`);
  const c = cohortStats(x);
  console.log(`  ${lbl.padEnd(28)} n=${String(c.n).padStart(5)}  WR ${c.wr.toFixed(2).padStart(6)}%  pt mort ${c.be.toFixed(1)}  marge ${c.marge.toFixed(2).padStart(7)}  ${c.sig.toFixed(1).padStart(5)} sig  R/ep ${c.rt.toFixed(4).padStart(8)}  R ${c.R.toFixed(1).padStart(7)}`);
};

console.log(`\n### \`slope\` SEUL — ${ep.length} episodes\n`);
L("TOUT", ep);
console.log("\n=== LA MAGNITUDE ORDONNE-T-ELLE ? (le test qui compte) ===");
for (const m of [3, 5, 8, 10]) L(`|score| = ${m}`, ep.filter((x) => x.mag === m));
console.log("\n=== PAR COTE CHOISI ===");
for (const s of ["BUY", "SELL"]) L(`fade ${s}`, ep.filter((x) => x.side === s));
console.log("\n=== PAR TABLE (= signe de la pente live) ===");
for (const t of ["SELL", "BUY"]) L(`pente ${t === "SELL" ? "POSITIVE" : "NEGATIVE"}`, ep.filter((x) => x.tbl === t));
console.log("\n=== PAR NIVEAU ===");
for (const l of ["flat", "weak", "strong", "extreme"]) L(l, ep.filter((x) => x.lvl === l));
console.log("\n=== PAR COLONNE ===");
for (const c of ["EXPLOSIVE_DOWN", "FAST_DOWN", "SOFT_DOWN", "FLAT", "SOFT_UP", "FAST_UP", "EXPLOSIVE_UP"])
  L(c, ep.filter((x) => x.col === c));
console.log("\n=== LES CASES (>= 40 episodes) ===");
const cells = {};
for (const x of ep) (cells[`${x.tbl} · ${x.lvl} x ${x.col}`] ??= []).push(x);
for (const [k, v] of Object.entries(cells).sort((a, b) => b[1].length - a[1].length))
  if (v.length >= 40) L(`${k} [${v[0].val > 0 ? "+" : ""}${v[0].val}]`, v);
console.log("\n=== ACCORD avec le cote que le FADE COMPLET avait choisi ===");
L("slope d'accord", ep.filter((x) => x.agree));
L("slope en desaccord", ep.filter((x) => !x.agree));
