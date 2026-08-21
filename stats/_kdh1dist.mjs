import fs from "fs";
const dir="data/matrix"; let pool=[];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".csv"))){
  const L=fs.readFileSync(dir+"/"+f,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const h=L[0].split(";"); const iK=h.indexOf("stoch_k_h1_s0"),iD=h.indexOf("stoch_d_h1_s0");
  if(iK<0||iD<0) continue;
  for(const l of L.slice(1)){const c=l.split(";");const k=parseFloat(c[iK]),d=parseFloat(c[iD]);if(!isNaN(k)&&!isNaN(d))pool.push(k-d);}
}
pool.sort((a,b)=>a-b);
const q=p=>pool[Math.floor(pool.length*p)];
console.log(`K−D H1 s0 — POOL n=${pool.length} · distribution symétrique :`);
console.log("percentile bas  →  valeur   |   miroir haut  →  valeur   |  somme (0=symétrique)");
console.log("─".repeat(74));
for(const [lo,hi] of [[1,99],[5,95],[10,90],[25,75],[35,65],[50,50]]){
  const vl=q(lo/100), vh=q(hi/100);
  console.log(`  P${String(lo).padStart(2)}  →  ${vl.toFixed(1).padStart(6)}      |   P${String(hi).padStart(2)}  →  ${vh.toFixed(1).padStart(6)}      |   ${(vl+vh>=0?"+":"")+(vl+vh).toFixed(1)}`);
}
