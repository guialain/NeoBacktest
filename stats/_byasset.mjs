import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const rows=[];
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort()){
  const a=f.replace(/\.csv$/i,""); const sigs=(runMatrixBacktest(path.join(D,f)).signals||[]).filter(s=>typeof s.R==="number");
  const w=sigs.filter(s=>s.outcome==="WIN").length,l=sigs.filter(s=>s.outcome==="LOSS").length,R=sigs.reduce((x,s)=>x+s.R,0);
  rows.push({a,n:sigs.length,wr:(w+l)?w/(w+l)*100:0,R,avg:sigs.length?R/sigs.length:0});
}
rows.sort((x,y)=>y.R-x.R);
console.log("actif".padEnd(13)+"n".padStart(6)+"WR".padStart(8)+"avgR".padStart(9)+"totalR".padStart(10));
let tN=0,tR=0,tW=0,tL=0;
for(const r of rows){ console.log(r.a.padEnd(13)+String(r.n).padStart(6)+(r.wr.toFixed(1)+"%").padStart(8)+((r.avg>=0?"+":"")+r.avg.toFixed(3)).padStart(9)+((r.R>=0?"+":"")+r.R.toFixed(1)).padStart(10)); tN+=r.n; tR+=r.R; }
const pos=rows.filter(r=>r.R>0).length,neg=rows.filter(r=>r.R<0).length;
console.log("─".repeat(46));
console.log(`TOTAL ${tN} trades · ${(tR>=0?"+":"")+tR.toFixed(1)} R · ${pos} actifs POS / ${neg} NEG`);
console.log(`hors les 3 pires : ${(tR - rows.slice(-3).reduce((x,r)=>x+r.R,0)).toFixed(1)} R`);
