// TROU DE LOGIQUE ? — CONT qui tire malgré un TURN CONTRAIRE (owner 2026-07-21, cas UK_100).
//   turn contraire = dominanceTurn qui pointe CONTRE le trade (BUY + TURN_DOWN, SELL + TURN_UP)
//   OU cross K/D contraire (BUY + CROSS_DOWN, SELL + CROSS_UP). Répétitif = trou ; dispersé = bruit.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const CONT = [], byAsset = {}, byMonth = {};
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
  const a = f.replace(/\.csv$/i, "");
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type !== "EXHAUSTION" && typeof s.R === "number") { s._a = a; CONT.push(s); }
}
const turnAgainst = (s) => { const t = s.obs?.dominanceTurn ?? s.dominanceTurn; return (s.side === "BUY" && t === "TURN_DOWN") || (s.side === "SELL" && t === "TURN_UP"); };
const crossAgainst = (s) => (s.side === "BUY" && s.crossState === "CROSS_DOWN") || (s.side === "SELL" && s.crossState === "CROSS_UP");
function met(a) { if (!a.length) return "n=0"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  PF ${gL ? (gW / gL).toFixed(2) : "∞"}  R ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
console.log("CONT TOTAL :", met(CONT), "\n");
console.log("── signature du turn/cross CONTRAIRE ──");
console.log("  turn ADX contraire   :", met(CONT.filter(turnAgainst)));
console.log("  cross K/D contraire  :", met(CONT.filter(crossAgainst)));
console.log("  turn OU cross contra :", met(CONT.filter((s) => turnAgainst(s) || crossAgainst(s))));
console.log("  turn ET cross contra :", met(CONT.filter((s) => turnAgainst(s) && crossAgainst(s))));
console.log("  ni l'un ni l'autre   :", met(CONT.filter((s) => !turnAgainst(s) && !crossAgainst(s))));
// RÉPÉTITIF ? — le pire (turn ET cross contra) par actif et par mois
const bad = CONT.filter((s) => turnAgainst(s) && crossAgainst(s));
const g = (arr, key) => { const o = {}; for (const s of arr) (o[key(s)] ??= []).push(s); return o; };
console.log("\n── « turn ET cross contra » PAR ACTIF (répétitif = trou) ──");
for (const [a, arr] of Object.entries(g(bad, (s) => s._a)).sort((x, y) => x[1].reduce((p, s) => p + s.R, 0) - y[1].reduce((p, s) => p + s.R, 0))) console.log(`  ${a.padEnd(12)} ${met(arr)}`);
console.log("\n── PAR MOIS ──");
for (const [mo, arr] of Object.entries(g(bad, (s) => String(s.tsMT).slice(0, 7))).sort()) console.log(`  ${mo}  ${met(arr)}`);
