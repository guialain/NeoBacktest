import fs from "fs";
const dir="data/matrix";
const rows=[];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".csv"))){
  const sym=f.replace(".csv","");
  const L=fs.readFileSync(dir+"/"+f,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const iC1=L[0].split(";").indexOf("adx14_h1_c1");
  const v=L.slice(1).map(l=>parseFloat(l.split(";")[iC1])).filter(Number.isFinite).sort((a,b)=>a-b);
  const q=p=>v[Math.floor(v.length*p)];
  rows.push({sym, med:q(.5), p75:q(.75), p90:q(.90), p95:q(.95), max:v[v.length-1], pctOver40:100*v.filter(x=>x>=40).length/v.length, pctOver50:100*v.filter(x=>x>=50).length/v.length});
}
rows.sort((a,b)=>b.p90-a.p90);
console.log("actif".padEnd(12)+" méd   p75   p90   p95   max  | %≥40  %≥50");
console.log("─".repeat(58));
for(const r of rows) console.log(`${r.sym.padEnd(12)} ${r.med.toFixed(1).padStart(4)} ${r.p75.toFixed(1).padStart(5)} ${r.p90.toFixed(1).padStart(5)} ${r.p95.toFixed(1).padStart(5)} ${r.max.toFixed(0).padStart(5)}  | ${r.pctOver40.toFixed(1).padStart(4)}% ${r.pctOver50.toFixed(1).padStart(4)}%`);
