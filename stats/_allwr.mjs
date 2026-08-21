import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const st=(s)=>{const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);return{n:s.length,wr:(w+l)?w/(w+l)*100:0,R};};
const rows=[];
for(const f of fs.readdirSync(D).filter(x=>x.toLowerCase().endsWith(".csv")).sort()){
  const a=f.replace(/\.csv$/i,""); const all=(runMatrixBacktest(path.join(D,f)).signals||[]).filter(s=>typeof s.R==="number");
  const c=st(all.filter(s=>s.type==="CONTINUATION")), e=st(all.filter(s=>s.type==="EXHAUSTION")), t=st(all);
  rows.push({a,c,e,t});
}
console.log("actif".padEnd(12)+"CONT WR/n/R".padStart(20)+"EXH WR/n/R".padStart(20)+"TOUT WR/n/R".padStart(20));
const fmt=(x)=>`${x.wr.toFixed(0)}% ${x.n} ${(x.R>=0?"+":"")+x.R.toFixed(0)}`;
for(const r of rows.sort((x,y)=>y.c.wr-x.c.wr)) console.log(r.a.padEnd(12)+fmt(r.c).padStart(20)+fmt(r.e).padStart(20)+fmt(r.t).padStart(20));
const sum=(k)=>rows.reduce((a,r)=>a+r[k].R,0);
console.log("─".repeat(72));
console.log(`TOTAL CONT ${(sum("c")>=0?"+":"")+sum("c").toFixed(0)} · EXH ${(sum("e")>=0?"+":"")+sum("e").toFixed(0)} · TOUT ${(sum("t")>=0?"+":"")+sum("t").toFixed(0)}`);
