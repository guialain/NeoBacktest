// _wr_par_score_v1.mjs — LE BAREME v1 TRIE-T-IL ? Par COTE, en WR (08/08).
//
// ⭐⭐⭐ REPONSE : il trie le BUY et ZIGZAGUE en SELL. C'est la precision qui manquait a « `sExh` ne
//   trie pas sa propre figure » — il trie, mais d'un seul cote.
//     BUY  cumulatif  87,7 → 88,0 → 88,8 → 89,9 → 90,6 → 91,2   (seuils 10→35, pop PROD)
//     SELL par bande  72,3 · 77,7 · 70,4 · 84,8 · 67,2 · 81,6 · 89,8 · 78,9 · 65,0 · 41,7
//   En population non contrainte, deux bandes ADJACENTES ecartees de 33 points cote SELL
//   (`30-34` = 57,9 % puis `40-44` = 90,7 %), et 5 bandes sur 10 sous le point mort (75,0 %).
//
// ⚠ Le R depend du NOMBRE de trades : il ne dit rien de la precision du signal. On lit le WR —
//   et les DEUX WR, par tir et par grappe (les tirs ne sont pas independants).
// ⚠ Ne pas prendre `55 (plafond)` pour une population : 2 grappes de chaque cote.
//
//   usage : node stats/_wr_par_score_v1.mjs
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";
import { readdirSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "../data/matrix");
const ASSETS = readdirSync(DIR).filter((f) => f.endsWith(".csv")).map((f) => f.slice(0, -4));

const collect = (opts) => {
  const F = [];
  for (const a of ASSETS) {
    let r; try { r = runMatrixBacktest(`${DIR}/${a}.csv`, { chargeSpread: true, ...opts }); } catch { continue; }
    for (const s of r.signals ?? []) {
      if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
      // ⚠ `sc.exh` est la CONVICTION ORIENTEE sur [−55·+55] — pas `sc.exhConviction`, qui n'existe pas.
      const v = s.sc?.exh; if (!Number.isFinite(v)) continue;
      F.push({ a, d: String(s.tsMT).slice(0, 10), side: s.side, win: s.R > 0, R: s.R, s: Math.abs(v) });
    }
  }
  return F;
};
const st = (rs) => { const n = rs.length; if (!n) return null;
  const G = {}; for (const x of rs) { const k = `${x.a}|${x.d}`; (G[k] ??= { n: 0, w: 0 }); G[k].n++; G[k].w += x.win ? 1 : 0; }
  const gs = Object.values(G);
  return { n, wr: 100 * rs.filter((x) => x.win).length / n, R: rs.reduce((a, x) => a + x.R, 0), g: gs.length,
    wrg: 100 * gs.reduce((a, o) => a + o.w / o.n, 0) / gs.length, gBas: gs.filter((o) => o.w / o.n < 0.75).length }; };
const BANDES = [[10, 15], [15, 20], [20, 25], [25, 30], [30, 35], [35, 40], [40, 45], [45, 50], [50, 55], [55, 999]];
const lbl = ([lo, hi]) => hi > 100 ? "55 (plafond)" : `${lo}-${hi - 1}`;

for (const [nom, opts] of [["PROD (spacing + maxOpen 30)", {}],
                           ["NON CONTRAINTE", { spacing: false, maxOpen: 100000 }]]) {
  const F = collect(opts);
  console.log(`\n######## ${nom} — ${F.length} tirs EXH ########`);
  for (const side of ["BUY", "SELL"]) {
    const S = F.filter((x) => x.side === side); const t = st(S);
    console.log(`\n=== EXH ${side} ===  ${t.n} tirs · ${t.wr.toFixed(1)} %/tir · ${t.wrg.toFixed(1)} %/grappe · R ${t.R.toFixed(1)}`);
    console.log("  |score|        tirs   WR/tir  WR/grappe  grap  <75%       R");
    for (const b of BANDES) {
      const o = st(S.filter((x) => x.s >= b[0] && x.s < b[1]));
      if (!o) { console.log(`  ${lbl(b).padEnd(13)}     0`); continue; }
      console.log(`  ${lbl(b).padEnd(13)} ${String(o.n).padStart(5)} ${o.wr.toFixed(1).padStart(7)}% ${o.wrg.toFixed(1).padStart(9)}% ${String(o.g).padStart(5)} ${String(o.gBas).padStart(5)} ${o.R.toFixed(1).padStart(7)}`);
    }
    console.log("  -- cumulatif (ce que donnerait une hausse de seuil) --");
    for (const s0 of [10, 15, 20, 25, 30, 35, 40]) {
      const o = st(S.filter((x) => x.s >= s0));
      console.log(`     >= ${String(s0).padStart(2)}      ${String(o.n).padStart(5)} ${o.wr.toFixed(1).padStart(7)}% ${o.wrg.toFixed(1).padStart(9)}% ${String(o.g).padStart(5)} ${String(o.gBas).padStart(5)} ${o.R.toFixed(1).padStart(7)}`);
    }
  }
}
