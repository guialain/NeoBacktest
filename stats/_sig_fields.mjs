import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const r = runMatrixBacktest("C:/Users/Public/Neo-Backtest/data/matrix/US_30.csv");
const s = (r.signals || []).find(x => typeof x.R === "number");
console.log("CHAMPS D'UN SIGNAL :"); console.log(Object.keys(s || {}).join(" · "));
console.log("\nEXEMPLE :"); console.log(JSON.stringify(s, null, 1).slice(0, 900));
// valeurs distinctes des champs candidats profil
const all = (r.signals || []).filter(x => typeof x.R === "number");
for (const k of ["type","side","profile","label","winner","action","regime","family"]) {
  const vals = [...new Set(all.map(x => x[k]).filter(v => v != null))];
  if (vals.length) console.log(`\n${k} : ${vals.slice(0,12).join(" · ")}`);
}
