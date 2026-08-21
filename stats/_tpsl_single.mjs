import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const files=fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort();
const contTot=(opts)=>{let R=0,w=0,l=0,n=0;for(const f of files){const s=(runMatrixBacktest(path.join(D,f),opts).signals||[]).filter(x=>typeof x.R==="number"&&x.type==="CONTINUATION");R+=s.reduce((a,b)=>a+b.R,0);w+=s.filter(x=>x.outcome==="WIN").length;l+=s.filter(x=>x.outcome==="LOSS").length;n+=s.length;}return{R,wr:(w+l)?w/(w+l)*100:0,n};};
console.log("config UNIQUE (WIP CONT-only) :");
for(const [tp,sl] of [[0.65,1.95],[0.9,2.5],[0.9,3.0],[1.2,3.0],[1.2,3.5],[0.8,3.0]]){
  const r=contTot({tpAtr:tp,slAtr:sl});
  console.log(`  tp=${tp} sl=${sl}  n ${String(r.n).padStart(4)} · WR ${r.wr.toFixed(1)}% · R ${(r.R>=0?"+":"")+r.R.toFixed(0)}`);
}
console.log("(rappel : WIP défaut +292 · par-actif optimisé +628 · commité impulse défaut +744)");
