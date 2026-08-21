import fs from "fs";
const dir="data/matrix"; const q=(v,p)=>v[Math.floor(v.length*p)];
const per=[]; let pool=[];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".csv"))){
  const sym=f.replace(".csv","");
  const L=fs.readFileSync(dir+"/"+f,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const h=L[0].split(";"); const iK=h.indexOf("stoch_k_h1_s0"),iD=h.indexOf("stoch_d_h1_s0");
  if(iK<0||iD<0) continue;
  const v=L.slice(1).map(l=>{const c=l.split(";");const k=parseFloat(c[iK]),d=parseFloat(c[iD]);return (isNaN(k)||isNaN(d))?null:k-d;}).filter(x=>x!=null).sort((a,b)=>a-b);
  per.push({sym,n:v.length,p10:q(v,.1),p25:q(v,.25),med:q(v,.5),p75:q(v,.75),p90:q(v,.9)});
  pool=pool.concat(v);
}
pool.sort((a,b)=>a-b);
console.log("=== K−D H1 s0 par actif (trié p90) ===");
console.log("actif".padEnd(12)+"  p10    p25    méd    p75    p90");
per.sort((a,b)=>b.p90-a.p90);
for(const r of per) console.log(`${r.sym.padEnd(12)} ${r.p10.toFixed(1).padStart(6)} ${r.p25.toFixed(1).padStart(6)} ${r.med.toFixed(1).padStart(6)} ${r.p75.toFixed(1).padStart(6)} ${r.p90.toFixed(1).padStart(6)}`);
console.log(`\nPOOL (n=${pool.length}) : p10=${q(pool,.1).toFixed(1)} p25=${q(pool,.25).toFixed(1)} méd=${q(pool,.5).toFixed(1)} p75=${q(pool,.75).toFixed(1)} p90=${q(pool,.9).toFixed(1)}`);
// écart-type des p90 entre actifs = mesure d'agnosticité
const p90s=per.map(r=>r.p90); const m=p90s.reduce((a,b)=>a+b,0)/p90s.length;
const sd=Math.sqrt(p90s.reduce((a,b)=>a+(b-m)**2,0)/p90s.length);
console.log(`\np90 par actif : moyenne ${m.toFixed(1)} · écart-type ${sd.toFixed(2)} (faible = AGNOSTIC)`);
