import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const all = [];
for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) if (typeof s.R === "number") all.push(s);
const R = all.reduce((x, s) => x + s.R, 0), w = all.filter(s => s.outcome === "WIN").length, l = all.filter(s => s.outcome === "LOSS").length;
const sorted = all.sort((a, b) => String(a.tsMT).localeCompare(String(b.tsMT))); let c = 0, p = 0, dd = 0; for (const s of sorted) { c += s.R; p = Math.max(p, c); dd = Math.max(dd, p - c); }
console.log(`n=${all.length} totalR ${(R>=0?"+":"")+R.toFixed(1)} WR ${(w/(w+l)*100).toFixed(2)}% maxDD ${dd.toFixed(1)} R/DD ${(R/dd).toFixed(1)}`);
