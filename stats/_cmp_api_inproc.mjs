// contrôle : le run EN PROCESSUS et le run par l'API donnent-ils la MÊME population ?
//   Sans ce contrôle, un A/B mené en processus se comparerait à une référence mesurée par l'API,
//   et l'écart de population passerait pour l'effet du veto.
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const A = "US_30";
const loc = runMatrixBacktest(`C:/Users/Public/Neo-Backtest/data/matrix/${A}.csv`,
  { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
const api = await (await fetch(`http://localhost:3001/api/matrix/run/${A}?maxOpen=30&cadenceMin=2&chargeSpread=true`)).json();
const n = (r) => (r.signals || []).filter((s) => typeof s.R === "number").length;
console.log(`${A}  en processus ${n(loc)}   ·   par l'API ${n(api)}`);
console.log("params locaux :", JSON.stringify(loc.params));
console.log("params API    :", JSON.stringify(api.params));
