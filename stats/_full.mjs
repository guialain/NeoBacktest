import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const byM={},byA={},all=[];
for (const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort()){const a=f.replace(/\.csv$/i,"");for(const s of (runMatrixBacktest(path.join(D,f)).signals||[])){if(typeof s.R!=="number")continue;all.push(s);const m=String(s.tsMT).slice(0,7);byM[m]=(byM[m]||0)+s.R;(byA[a]??={n:0,R:0});byA[a].n++;byA[a].R+=s.R;}}
const R=all.reduce((x,s)=>x+s.R,0),w=all.filter(s=>s.outcome==="WIN").length,l=all.filter(s=>s.outcome==="LOSS").length;
const so=all.sort((a,b)=>String(a.tsMT).localeCompare(String(b.tsMT)));let c=0,p=0,dd=0;for(const s of so){c+=s.R;p=Math.max(p,c);dd=Math.max(dd,p-c);}
console.log(`n=${all.length} totalR ${(R>=0?"+":"")+R.toFixed(1)} WR ${(w/(w+l)*100).toFixed(2)}% maxDD ${dd.toFixed(1)} R/DD ${(R/dd).toFixed(1)}`);
console.log(`mois: ${Object.keys(byM).sort().map(m=>m+" "+(byM[m]>=0?"+":"")+byM[m].toFixed(1)).join(" · ")}`);
fs.writeFileSync("stats/_byA.json",JSON.stringify(byA));
