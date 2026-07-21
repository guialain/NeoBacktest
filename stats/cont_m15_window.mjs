// Fenêtre du cross M15 : 4→3→2 bougies. La cohorte JETÉE devient-elle perdante en resserrant ?
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const CONT = [];
for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (s.type !== "EXHAUSTION" && typeof s.R === "number") CONT.push(s);
// contra M15 = cross dans la fenêtre ET K/D M15 contre le trade
const contra = (s) => (s.side === "BUY" && s.m15KD < 0) || (s.side === "SELL" && s.m15KD > 0);
const inWin = (s, maxAge) => s.m15CrossAge != null && s.m15CrossAge <= maxAge;
function met(a) { if (!a.length) return "n=0"; const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0); return `n=${String(a.length).padStart(4)}  WR ${((w / (w + l)) * 100 || 0).toFixed(0).padStart(3)}%  avgR ${(R / a.length >= 0 ? "+" : "") + (R / a.length).toFixed(3)}  totalR ${(R >= 0 ? "+" : "") + R.toFixed(1)}`; }
console.log("CONT total :", met(CONT), "\n");
console.log("COHORTE À JETER (cross M15 dans fenêtre + K/D contra) — reste-t-elle GAGNANTE ?");
for (const [lbl, age] of [["4 bougies (age 0-2)", 2], ["3 bougies (age 0-1)", 1], ["2 bougies (age 0)", 0]]) {
  const drop = CONT.filter((s) => contra(s) && inWin(s, age));
  console.log(`  ${lbl.padEnd(22)} ${met(drop)}`);
}
console.log("\n  réf : K/D M15 contra SEUL (sans cross) :", met(CONT.filter(contra)));
console.log("  réf : cross M15 age 0 SANS regarder K/D    :", met(CONT.filter((s) => s.m15CrossAge === 0)));
