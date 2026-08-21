import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const byM = {};
for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) if (typeof s.R === "number") { const m=String(s.tsMT).slice(0,7); byM[m]=(byM[m]||0)+s.R; }
console.log("par mois : " + Object.keys(byM).sort().map(m=>m+" "+(byM[m]>=0?"+":"")+byM[m].toFixed(1)).join(" · "));
