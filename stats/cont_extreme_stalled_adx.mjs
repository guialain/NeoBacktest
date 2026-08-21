// Signature : CONT qui achète/vend l'extrémité ÉPUISÉE (owner cas US_30 07/17).
//   zone extrême EN SENS (BUY@EXTREME_HAUTE / SELL@EXTREME_BASSE) — le CONT tardif au sommet/plancher.
//   Croisé avec maturité du cross et ΔADX (l'ADX s'effondre-t-il = épuisement ?).
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const EX = [];   // CONT en zone extrême EN SENS
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (s.type === "EXHAUSTION" || typeof s.R !== "number") continue;
    const z = s.obs?.zone ?? s.zoneH1;
    const ext = (s.side === "BUY" && z === "EXTREME_HAUTE") || (s.side === "SELL" && z === "EXTREME_BASSE");
    if (ext) EX.push(s);
  }
function met(a) { if (!a.length) return "n=0"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return `n=${String(a.length).padStart(3)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  R ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
const split = (lbl, keyFn, order) => { console.log(`── ${lbl} ──`); const g = {}; for (const s of EX) (g[keyFn(s)] ??= []).push(s); for (const k of (order || Object.keys(g).sort()).filter((x) => g[x])) console.log(`   ${String(k).padEnd(16)} ${met(g[k])}`); console.log(); };
console.log(`CONT en zone EXTRÊME EN SENS (achète le sommet / vend le plancher) : ${met(EX)}\n`);
split("maturité du cross", (s) => s.crossMat ?? "(pas de cross)", ["FRESH", "CONFIRMED", "STALLED", "(pas de cross)"]);
split("ΔADX (l'ADX s'effondre ?)", (s) => s.dAdx == null ? "?" : s.dAdx <= -3 ? "≤−3 (chute forte)" : s.dAdx <= -1 ? "−3..−1" : s.dAdx < 1 ? "plat" : "↑", ["≤−3 (chute forte)", "−3..−1", "plat", "↑"]);
split("bande ADX", (s) => { const a = s.adx; return a == null ? "?" : a < 25 ? "<25" : a < 34 ? "25-34" : "≥34"; }, ["<25", "25-34", "≥34"]);
// croisement clé : STALLED × ΔADX qui chute
console.log("── STALLED × ΔADX ≤ −1 (le cas US_30 : cross calé + ADX qui s'effondre) ──");
console.log("   " + met(EX.filter((s) => s.crossMat === "STALLED" && s.dAdx != null && s.dAdx <= -1)));
console.log("── (comparaison) reste des CONT extrêmes ──");
console.log("   " + met(EX.filter((s) => !(s.crossMat === "STALLED" && s.dAdx != null && s.dAdx <= -1))));
