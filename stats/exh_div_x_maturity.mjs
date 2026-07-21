// exh_div_x_maturity.mjs — `div0<0` APPORTE-T-IL au-delà de `maturité` ? (croisement décisif)
//   Si div0<0 ≈ FRESH → redondant (le moteur a déjà la maturité). Si div0<0 sépare bon/mauvais
//   DANS chaque maturité → il ajoute de l'information orthogonale = valeur réelle.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const EXH = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type === "EXHAUSTION" && typeof s.R === "number") EXH.push(s);
function met(a) {
  const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length;
  const R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0));
  return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  totalR ${(R >= 0 ? "+" : "") + R.toFixed(1)}`;
}
const cell = (mat, sign) => EXH.filter((s) => (s.crossMat ?? "(null)") === mat && (sign === "conv" ? s.div0 < 0 : s.div0 >= 0));
console.log("CROISEMENT maturité × signe(div0) — EXH\n");
for (const mat of ["FRESH", "CONFIRMED"]) {
  console.log(`  ${mat} :`);
  console.log(`     div0<0 (converge) : ${met(cell(mat, "conv"))}`);
  console.log(`     div0≥0 (diverge)  : ${met(cell(mat, "div"))}`);
}
// combien de FRESH sont div0<0 ? (mesure du recouvrement)
const fresh = EXH.filter((s) => s.crossMat === "FRESH");
const conf = EXH.filter((s) => s.crossMat === "CONFIRMED");
console.log(`\nrecouvrement : FRESH div0<0 = ${fresh.filter((s) => s.div0 < 0).length}/${fresh.length} · CONFIRMED div0<0 = ${conf.filter((s) => s.div0 < 0).length}/${conf.length}`);
