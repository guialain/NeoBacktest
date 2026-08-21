import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const byA = {};
for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith(".csv")).sort()) {
  const a = f.replace(/\.csv$/i, "");
  // reconstruire ce que le gate COUPE : ici le moteur A DÉJÀ le gate → on relit la cohorte via les WAIT ?
  // plus simple : compter, par actif, les Strong restants (le gate a retiré les mauvais)
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) {
    if (typeof s.R !== "number") continue;
    if (s.profile === "Strong Bull" || s.profile === "Strong Bear") { (byA[a] ??= { n: 0, R: 0 }); byA[a].n++; byA[a].R += s.R; }
  }
}
console.log("STRONG RESTANTS par actif (après gate) — R doit être ≥~0 partout :");
const rows = Object.entries(byA).sort((x, y) => y[1].R - x[1].R);
console.log(rows.map(([a, v]) => `${a} n${v.n}/${(v.R>=0?"+":"")+v.R.toFixed(1)}`).join(" · "));
const neg = rows.filter(([, v]) => v.R < -1);
console.log(`\nactifs Strong encore négatifs (<−1 R) : ${neg.length ? neg.map(([a,v])=>a+" "+v.R.toFixed(1)).join(" · ") : "aucun ✓"}`);
