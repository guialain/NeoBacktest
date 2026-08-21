import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const out={};
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort()){
  const a=f.replace(/\.csv$/i,""); const sigs=(runMatrixBacktest(path.join(D,f)).signals||[]).filter(s=>typeof s.R==="number" && s.type==="CONTINUATION");
  const w=sigs.filter(s=>s.outcome==="WIN").length,l=sigs.filter(s=>s.outcome==="LOSS").length,R=sigs.reduce((x,s)=>x+s.R,0);
  out[a]={n:sigs.length,wr:(w+l)?w/(w+l)*100:0,R,avg:sigs.length?R/sigs.length:0};
}
fs.writeFileSync(process.argv[2]||"stats/_cont_tmp.json", JSON.stringify(out));
const tot=Object.values(out).reduce((x,r)=>x+r.R,0), tn=Object.values(out).reduce((x,r)=>x+r.n,0);
console.log(`CONT-only : ${tn} trades · ${(tot>=0?"+":"")+tot.toFixed(1)} R`);
