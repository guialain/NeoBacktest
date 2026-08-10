// _score_bandes.mjs — WR PAR BANDE DE CONVICTION EXH, compact, population PROD seule.
//   Même mesure que `_wr_par_score_v1.mjs` mais sans le bloc NON CONTRAINTE ni les bandes
//   négatives : la sortie complète fait ~180 lignes et l'essentiel tient en 20.
//
// ⚠ CONVICTION **ORIENTÉE** (`+v` pour un BUY, `−v` pour un SELL), pas `|v|` : replier le négatif
//   sur le positif ferait lire un score qui CONTREDIT le côté comme une forte conviction.
//   Les bandes sous le seuil sont imprimées quand même — vides, c'est le contrôle que `SEUIL_V1`
//   s'applique là où on croit.
import { readdirSync } from "node:fs";
import path from "node:path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");

const DIR = path.resolve(import.meta.dirname, "../data/matrix");
const F = [];
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".csv"))) {
  const a = f.slice(0, -4);
  let r; try { r = runMatrixBacktest(`${DIR}/${f}`, { chargeSpread: true }); } catch { continue; }
  for (const s of r.signals ?? []) {
    if (s.strategy !== "EXH" || typeof s.R !== "number") continue;
    const v = s.sc?.exh; if (!Number.isFinite(v)) continue;
    F.push({ a, d: String(s.tsMT).slice(0, 10), side: s.side, win: s.R > 0, R: s.R,
             s: s.side === "BUY" ? v : -v });
  }
}
// ⚠ Une voix par grappe actif×jour : les tirs ne sont pas indépendants (σ gonflé ×9).
const st = (rs) => {
  if (!rs.length) return null;
  const G = {};
  for (const x of rs) { const k = `${x.a}|${x.d}`; (G[k] ??= { n: 0, w: 0 }); G[k].n++; G[k].w += x.win ? 1 : 0; }
  const g = Object.values(G);
  return { n: rs.length, wr: 100 * rs.filter((x) => x.win).length / rs.length,
           R: rs.reduce((a, x) => a + x.R, 0), g: g.length,
           wrg: 100 * g.reduce((a, o) => a + o.w / o.n, 0) / g.length,
           bas: g.filter((o) => o.w / o.n < 0.75).length };
};
const BANDES = [[0, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, 35], [35, 40], [40, 45],
                [45, 50], [50, 55], [55, 999]];
const l = (n, o) => console.log(`  ${n.padEnd(10)} ${String(o.n).padStart(5)} ${o.wr.toFixed(1).padStart(7)}%` +
  ` ${o.wrg.toFixed(1).padStart(8)}% ${String(o.g).padStart(4)} ${String(o.bas).padStart(4)} ${o.R.toFixed(1).padStart(7)}`);

console.log(`[POP PROD] [spread FACTURÉ] — ${F.length} tirs EXH\n`);
for (const side of ["BUY", "SELL"]) {
  const S = F.filter((x) => x.side === side), t = st(S);
  console.log(`=== EXH ${side} === ${t.n} tirs · ${t.wr.toFixed(1)} %/tir · ${t.wrg.toFixed(1)} %/grappe · R ${t.R.toFixed(1)}`);
  console.log("  |score|      tirs   WR/tir WR/grappe  grap <75%       R");
  for (const [lo, hi] of BANDES) {
    const o = st(S.filter((x) => x.s >= lo && x.s < hi));
    if (o) l(hi > 100 ? `≥ ${lo}` : `${lo}-${hi - 1}`, o); else console.log(`  ${(hi > 100 ? `≥ ${lo}` : `${lo}-${hi - 1}`).padEnd(10)}     0`);
  }
  console.log("  -- cumulatif --");
  for (const s0 of [10, 15, 20, 25, 30, 35, 40]) { const o = st(S.filter((x) => x.s >= s0)); if (o) l(`≥ ${s0}`, o); }
  console.log("");
}
