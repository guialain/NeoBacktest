// _spread_mode.mjs — QUI PAIE LE SPREAD : LE RISQUE OU LE GAIN ?
//   Usage: npx vite-node stats/_spread_mode.mjs [ACTIF]
//
// Trois états, sur exactement la même population de signaux :
//   A  hors spread            — la référence du dépôt, comparable à toute la littérature.
//   B  spread "raw"           — l'état RÉEL de la prod : SL/TP posés depuis le remplissage, donc le
//                               spread mord deux fois (TP plus loin ET SL plus tôt).
//   C  spread "sl"            — proposition owner : SL ÉLARGI du spread, TP inchangé. Le SL revient
//                               là où il serait sans spread ; on paie le broker dans les GAINS.
//
// ⚠ A DOIT reproduire la référence. Sinon B et C ne sont attribuables à rien.
// ⚠ C N'EST PAS GRATUIT : élargir le SL élargit le RISQUE. À risque en % constant la taille de
//   position baisse, ce que traduit un R plus faible au TP (`tpDist / (slDist + s)`). Le mode ne
//   crée pas d'argent — il déplace qui absorbe le coût. Le juger sur le R/trade, pas sur le WR seul.
import fs from "fs";
import path from "path";
process.env.NO_TRIO = process.env.NO_TRIO ?? "1";
import { runMatrixBacktest } from "../src/components/simulations/matrixBacktest.mjs";

const MATRIX = "C:/Users/Public/Neo-Backtest/data/matrix";
const only = process.argv[2] ? process.argv[2].toUpperCase() : null;
const files = fs.readdirSync(MATRIX).filter((f) => f.toLowerCase().endsWith(".csv"))
  .filter((f) => !only || f.replace(/\.csv$/i, "").toUpperCase() === only).sort();

const collect = (opts) => {
  const all = [];
  for (const f of files) {
    const r = runMatrixBacktest(path.join(MATRIX, f), { maxOpen: 30, cadenceMin: 2, ...opts });
    for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: r.asset, exit: s.exitTs || s.tsMT || "" });
  }
  return all;
};
const st = (t) => {
  const w = t.filter((x) => x.outcome === "WIN").length, l = t.filter((x) => x.outcome === "LOSS").length;
  const R = t.reduce((a, b) => a + b.R, 0);
  const o = [...t].sort((a, b) => a.exit.localeCompare(b.exit)); let e = 0, p = 0, d = 0;
  for (const x of o) { e += x.R; p = Math.max(p, e); d = Math.max(d, p - e); }
  return { n: t.length, wr: (w + l) ? 100 * w / (w + l) : NaN, rt: t.length ? R / t.length : NaN, R, dd: d };
};

const A = collect({}), B = collect({ chargeSpread: true }), C = collect({ chargeSpread: true, spreadMode: "sl" });
const f = (r) => `${String(r.n).padStart(5)} tr · WR ${r.wr.toFixed(2).padStart(6)} % · R/tr ${r.rt.toFixed(4).padStart(8)} · R ${r.R.toFixed(1).padStart(7)} · maxDD ${r.dd.toFixed(1).padStart(6)}`;
const a = st(A), b = st(B), c = st(C);

console.log("\n" + "=".repeat(98));
console.log(`QUI PAIE LE SPREAD ?${only ? "   —   " + only : "   —   univers"}`);
console.log("=".repeat(98));
console.log(`  A · hors spread (référence) ${f(a)}`);
console.log(`  B · spread "raw" (prod)     ${f(b)}`);
console.log(`  C · spread "sl" (owner)     ${f(c)}`);
console.log("-".repeat(98));
console.log(`  C − B                       ${String(c.n - b.n).padStart(5)} tr · WR ${(c.wr - b.wr).toFixed(2).padStart(6)} pt · R/tr ${(c.rt - b.rt).toFixed(4).padStart(8)} · R ${(c.R - b.R).toFixed(1).padStart(7)} · maxDD ${(c.dd - b.dd).toFixed(1).padStart(6)}`);
console.log(`  C − A (coût résiduel)       ${String(c.n - a.n).padStart(5)} tr · WR ${(c.wr - a.wr).toFixed(2).padStart(6)} pt · R/tr ${(c.rt - a.rt).toFixed(4).padStart(8)} · R ${(c.R - a.R).toFixed(1).padStart(7)} · maxDD ${(c.dd - a.dd).toFixed(1).padStart(6)}`);
console.log("=".repeat(98));

// ── D'OÙ VIENT L'ÉCART : composition des sorties. C doit avoir MOINS de SL et un TP moins payé. ──
const mix = (t) => { const m = {}; for (const x of t) m[x.reason] = (m[x.reason] ?? 0) + 1; return m; };
const rTP = (t) => { const w = t.filter((x) => x.reason === "TP"); return w.length ? w.reduce((s, x) => s + x.R, 0) / w.length : NaN; };
console.log("\n  composition des sorties (et R moyen d'un TP) :");
for (const [tag, t] of [["A", A], ["B", B], ["C", C]]) {
  const m = mix(t);
  console.log(`    ${tag}  TP ${String(m.TP ?? 0).padStart(5)}  SL ${String(m.SL ?? 0).padStart(5)}  OPEN_END ${String(m.OPEN_END ?? 0).padStart(4)}   ·   R moyen d'un TP = ${rTP(t).toFixed(4)}`);
}

if (!only) {
  console.log("\n  par ACTIF — R/tr    A → B → C :");
  for (const s of [...new Set(A.map((x) => x.asset))].sort()) {
    const sa = st(A.filter((x) => x.asset === s)), sb = st(B.filter((x) => x.asset === s)), sc = st(C.filter((x) => x.asset === s));
    if (!sa.n) continue;
    const tag = sc.rt > 0 && sb.rt <= 0 ? "   ⬅ C le repasse POSITIF" : (sc.rt <= 0 ? "   ⚠ negatif meme en C" : "");
    console.log(`    ${s.padEnd(12)} ${sa.rt.toFixed(4).padStart(8)} → ${sb.rt.toFixed(4).padStart(8)} → ${sc.rt.toFixed(4).padStart(8)}${tag}`);
  }
}
