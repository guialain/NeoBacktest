import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const byM = {}, byA = {}, all = [];
for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith(".csv")).sort()) {
  const a = f.replace(/\.csv$/i, "");
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number") continue; all.push(s); const mo = String(s.tsMT).slice(0, 7); byM[mo] = (byM[mo] || 0) + s.R; byA[a] = (byA[a] || 0) + s.R;
  }
}
const R = all.reduce((x, s) => x + s.R, 0), w = all.filter(s => s.outcome === "WIN").length, l = all.filter(s => s.outcome === "LOSS").length;
const sorted = all.sort((a, b) => String(a.tsMT).localeCompare(String(b.tsMT))); let c = 0, p = 0, dd = 0; for (const s of sorted) { c += s.R; p = Math.max(p, c); dd = Math.max(dd, p - c); }
console.log(`GATE STRONG : n=${all.length} totalR ${(R>=0?"+":"")+R.toFixed(1)} WR ${(w/(w+l)*100).toFixed(2)}% maxDD ${dd.toFixed(1)} R/DD ${(R/dd).toFixed(1)}`);
console.log(`par mois : ${Object.keys(byM).sort().map(m=>m+" "+(byM[m]>=0?"+":"")+byM[m].toFixed(1)).join(" · ")}`);
fs.writeFileSync("stats/_byA_gate.json", JSON.stringify(byA));
