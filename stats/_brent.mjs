import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const split=(asset,opts,label)=>{
  const all=(runMatrixBacktest(path.join(D,asset+".csv"),opts).signals||[]).filter(s=>typeof s.R==="number");
  for(const [fam,pred] of [["CONT",s=>s.type==="CONTINUATION"],["EXH",s=>s.type==="EXHAUSTION"],["TOUT",()=>true]]){
    const s=all.filter(pred);const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);
    console.log(`  ${(label+" "+fam).padEnd(26)} n ${String(s.length).padStart(4)} · WR ${((w+l)?w/(w+l)*100:0).toFixed(1)}% · avgR ${(s.length?R/s.length:0).toFixed(3)} · R ${(R>=0?"+":"")+R.toFixed(1)}`);
  }
};
console.log("=== BRENT_OIL (WIP) ===");
split("BRENT_OIL",{},"défaut");
split("BRENT_OIL",{tpAtr:0.65,slAtr:1.65},"tp0,65/sl1,65");
console.log("\n=== SILVER vs BTCUSD (WIP, défaut) — comportements différents ===");
split("SILVER",{},"SILVER");
split("BTCUSD",{},"BTCUSD");
