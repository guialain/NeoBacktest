// AGE-1 : se fend-il comme le trou noir ? Split par dominanceTurn × bande ADX (owner 2026-07-21).
//   Hypothèse : age1 + turn ADX (retournement confirmé) = bon ; age1 sans turn = mauvais.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const A1 = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type === "EXHAUSTION" && typeof s.R === "number" && s.crossAge === 1) A1.push(s);
function met(a) { if (!a.length) return "—"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return `n=${String(a.length).padStart(3)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  R ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
const split = (lbl, keyFn, order) => { console.log(`── ${lbl} ──`); const g = {}; for (const s of A1) { const k = keyFn(s); (g[k] ??= []).push(s); } for (const k of (order || Object.keys(g).sort()).filter((x) => g[x])) console.log(`   ${String(k).padEnd(22)} ${met(g[k])}`); console.log(); };
console.log(`AGE-1 EXH (réactivé) : ${met(A1)}\n`);
split("dominanceTurn (le TURN d'ADX)", (s) => s.obs?.dominanceTurn ?? s.dominanceTurn ?? "(null)", ["TURN_DOWN", "TURN_UP", "FALLING", "RISING", "FLAT", "(null)"]);
split("signe de div0", (s) => s.div0 == null ? "?" : s.div0 < 0 ? "div0<0 converge" : "div0≥0 diverge");
split("bande ADX", (s) => { const a = s.adx; return a == null ? "?" : a < 18 ? "<18" : a < 25 ? "18–25" : a < 40 ? "25–40" : "≥40"; }, ["<18", "18–25", "25–40", "≥40"]);
// croisement : turn ADX × bande
console.log("── dominanceTurn × (ADX<25 vs ≥25) ──");
for (const t of ["TURN_DOWN", "FALLING", "FLAT", "RISING", "TURN_UP"]) {
  const lo = A1.filter((s) => (s.obs?.dominanceTurn ?? s.dominanceTurn) === t && s.adx < 25);
  const hi = A1.filter((s) => (s.obs?.dominanceTurn ?? s.dominanceTurn) === t && s.adx >= 25);
  if (lo.length || hi.length) console.log(`   ${t.padEnd(10)} ADX<25 ${met(lo).padEnd(46)} ADX≥25 ${met(hi)}`);
}
