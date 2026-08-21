import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const r = runMatrixBacktest("C:/Users/Public/Neo-Backtest/data/matrix/US_30.csv");
const s = (r.signals||[]).find(x=>typeof x.R==="number" && x.plusDi!=null);
console.log("champs DI du signal :", Object.keys(s||{}).filter(k=>/di|spread|Spread/i.test(k)).join(" · "));
console.log("\nexemple :", JSON.stringify(Object.fromEntries(Object.entries(s||{}).filter(([k])=>/^(plusDi|minusDi|diDelta|dSpread|spreadRegime|plusDiRegime|minusDiRegime|dPlusDi|dMinusDi)/.test(k))), null, 1));
