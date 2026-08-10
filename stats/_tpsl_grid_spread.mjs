// _tpsl_grid_spread.mjs — LA GRILLE TP/SL REJOUÉE AVEC LE SPREAD FACTURÉ.
//   Usage: npx vite-node stats/_tpsl_grid_spread.mjs
//
// LA QUESTION : l'optimisation du 01/08 poussait vers des SL SERRÉS (`sl ≤ 1,5` sur 17/19 actifs,
//   « le levier est le SL »). Elle a été faite HORS SPREAD. Or resserrer le SL divise l'unité de R
//   et multiplie donc MÉCANIQUEMENT le coût du spread : à spread constant, `spread/(sl × atr)` monte
//   quand `sl` baisse. L'optimum de 01/08 est-il un artefact de cette omission ?
//
// ⭐ TOUS LES COUPLES SONT À RATIO EXACTEMENT 1:3 (`tp = sl/3`), donc TOUS à point mort 75 %.
//   C'est ce qui rend les WR directement comparables d'une ligne à l'autre — la règle 2 de
//   `TpSlConfig` l'interdit d'ordinaire, et c'est une propriété de CETTE grille, pas du modèle.
//   ⇒ On ne mesure que l'ÉCHELLE de sortie. Le ratio n'est pas une variable ici.
// ⭐ La grille contient TOUS les `sl` réellement configurés aujourd'hui (1,35 · 1,44 · 1,56 · 1,65 ·
//   1,95 défaut · 2,10 · 2,16 · 2,25 · 3,00), donc le statu quo de chaque actif est DANS le tableau.
//
// ⚠ Le cap de spread P50 est ACTIF (c'est le moteur courant). ⚠ Mesures en mono-actif : capacité
//   volontairement infinie, c'est l'outil des A/B — pas le portefeuille.
import fs from "fs";
import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
import { getTpSl } from "../../Matrix-Revolution/src/config/TpSlConfig.js";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
const SLS = [1.35, 1.44, 1.56, 1.65, 1.95, 2.10, 2.16, 2.25, 2.50, 3.00];

const st = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length, l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + (b.R || 0), 0);
  return { n: t.length, wr: (w + l) ? 100 * w / (w + l) : NaN, rt: t.length ? R / t.length : NaN, R };
};
const run = (file, sl, chargeSpread) => {
  const r = runMatrixBacktest(path.join(MATRIX, file), {
    maxOpen: 30, cadenceMin: 2, chargeSpread, tpAtr: +(sl / 3).toFixed(4), slAtr: sl,
  });
  return st((r.signals || []).filter((s) => typeof s.R === "number"));
};

const rows = [];
console.log(`\nGrille 1:3 — ${SLS.length} échelles × ${files.length} actifs × 2 modes. Point mort 75,00 % partout.\n`);
for (const f of files) {
  const asset = f.replace(/\.csv$/i, "");
  const cur = getTpSl(asset).sl;
  const A = {}, B = {};
  for (const sl of SLS) { A[sl] = run(f, sl, false); B[sl] = run(f, sl, true); }
  if (!A[SLS[0]].n) { console.log(`${asset.padEnd(12)} aucun trade (hors whitelist)`); continue; }
  const best = (o) => SLS.filter((s) => Number.isFinite(o[s].rt)).sort((x, y) => o[y].rt - o[x].rt)[0];
  const bA = best(A), bB = best(B);
  rows.push({ asset, cur, bA, bB, A, B });
  const cell = (o, sl, mark) => `${sl === mark ? "[" : " "}${Number.isFinite(o[sl].rt) ? o[sl].rt.toFixed(3) : "  —  "}${sl === mark ? "]" : " "}`;
  console.log(`${asset.padEnd(12)} config sl=${String(cur).padEnd(5)} | hors spread ${SLS.map((s) => cell(A, s, bA)).join("")}  → opt ${bA}`);
  console.log(`${" ".repeat(12)} ${" ".repeat(12)}| SPREAD      ${SLS.map((s) => cell(B, s, bB)).join("")}  → opt ${bB}`);
}

// ── LA SYNTHÈSE — l'optimum se DÉPLACE-T-IL, et dans quel sens ? ──
console.log("\n" + "=".repeat(96));
console.log(`${"actif".padEnd(12)} ${"config".padStart(7)} ${"opt hors spread".padStart(16)} ${"opt SPREAD".padStart(11)} ${"déplacement".padStart(12)}   R/tr au config → à l'opt`);
console.log("-".repeat(96));
let wider = 0, tighter = 0, same = 0;
for (const r of rows) {
  const d = r.bB - r.bA;
  if (d > 0) wider++; else if (d < 0) tighter++; else same++;
  const gain = r.B[r.bB].rt - (r.B[r.cur]?.rt ?? NaN);
  const tag = d > 0 ? `+${d.toFixed(2)} PLUS LARGE` : d < 0 ? `${d.toFixed(2)} plus serré` : "inchangé";
  console.log(`${r.asset.padEnd(12)} ${String(r.cur).padStart(7)} ${String(r.bA).padStart(16)} ${String(r.bB).padStart(11)} ${tag.padStart(12)}   ${Number.isFinite(r.B[r.cur]?.rt) ? r.B[r.cur].rt.toFixed(4) : "—"} → ${r.B[r.bB].rt.toFixed(4)}${Number.isFinite(gain) && gain > 0 ? `  (+${gain.toFixed(4)})` : ""}`);
}
console.log("-".repeat(96));
console.log(`  l'optimum se déplace vers un SL PLUS LARGE sur ${wider}/${rows.length} actifs · plus serré ${tighter} · inchangé ${same}`);
console.log(`  ⚠ Un déplacement n'est PAS une recommandation : ces optima sont IN-SAMPLE sur une seule fenêtre.`);
console.log(`  ⚠ Lire aussi le VOLUME et le HOLD avant de bouger un couple — cf. TpSlConfig règle 3.`);
