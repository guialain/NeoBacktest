// _pb_neutralite.mjs — LE CRITERE D'APPARTENANCE A-T-IL TOUCHE L'EXH ?
// ⭐⭐ Avec `MIN_PB=1000` la boite PB ne tire jamais : l'EXH doit etre IDENTIQUE au socle.
//   Socle de reference 10/08 : **933 tirs · R +169,6** (BUY 446 / SELL 487).
// ⚠ Un ecart, meme d'un tir, veut dire que le critere fuit hors de sa boite.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = "1"; process.env.MIN_PB = "1000";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith(".csv")))
  for (const s of (runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true }).signals || []))
    if (typeof s.R === "number") all.push(s);
const fini = s => s.outcome === "WIN" || s.outcome === "LOSS";
const E = all.filter(s => s.strategy === "EXH" && fini(s));
const R = E.reduce((a,b)=>a+(b.R||0),0);
const c = side => E.filter(s => s.side === side);
console.log(`\n  EXH  ${E.length} tirs · R ${R>=0?"+":""}${R.toFixed(1)}   (BUY ${c("BUY").length} / SELL ${c("SELL").length})`);
console.log(`  socle 933 tirs · R +169.6  (BUY 446 / SELL 487)`);
console.log(`  ${E.length===933 && Math.abs(R-169.6)<0.05 ? "✅ NEUTRE" : "🔴 L'EXH A BOUGE"}`);
console.log(`  PB tires : ${all.filter(s=>s.strategy==="PB"&&fini(s)).length}  (doit etre 0)\n`);
