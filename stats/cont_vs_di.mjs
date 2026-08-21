// TROU ? — CONT à CONTRE-SENS du DI (owner, chart US_30 : BUY dans une descente forte).
//   Le moteur : ADX non signé (dominance) ; le DI (+DI/−DI) porte la DIRECTION, NON branché.
//   DI contre = BUY avec −DI>+DI (tendance baissière) ou SELL avec +DI>−DI. Répétitif = trou.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const CONT = [], byA = {}, byM = {};
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const a = f.replace(/\.csv$/i, "");
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number" || s.diDelta == null) continue;
    s._a = a; CONT.push(s);
  }
}
// DI orienté par le trade : >0 = DI DANS le sens · <0 = DI CONTRE
const diRel = (s) => (s.side === "BUY" ? s.diDelta : -s.diDelta);
function met(a) { if (!a.length) return "n=0"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  totalR ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
console.log("CONT total :", met(CONT), "\n── par orientation du DI (spread +DI−−DI, orienté trade) ──");
for (const [lbl, pred] of [["DI CONTRE fort (< −5)", (v) => v < -5], ["DI contre (−5..0)", (v) => v >= -5 && v < 0], ["DI avec (0..5)", (v) => v >= 0 && v < 5], ["DI avec fort (≥5)", (v) => v >= 5]])
  console.log("  " + lbl.padEnd(22) + met(CONT.filter((s) => pred(diRel(s)))));
// croisé avec la FORCE (dominance) : DI contre × ADX fort = fighting a strong trend (le cas US_30)
console.log("\n── DI CONTRE × dominance (le cas : buy contre une tendance FORTE) ──");
for (const dom of ["LOW", "MEDIUM", "HIGH", "EXTREME"]) {
  const a = CONT.filter((s) => diRel(s) < 0 && (s.obs?.dominance) === dom);
  if (a.length) console.log(`   DI contre · dominance ${dom.padEnd(8)} ${met(a)}`);
}
// répétitif : DI contre fort, par mois
const bad = CONT.filter((s) => diRel(s) < -5);
const g = {}; for (const s of bad) (g[String(s.tsMT).slice(0, 7)] ??= []).push(s);
console.log("\n── DI CONTRE fort (<−5) par MOIS ──");
for (const m of Object.keys(g).sort()) console.log(`   ${m}  ${met(g[m])}`);
