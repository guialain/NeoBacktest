import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let buy=[];
for(const a of assets){
  const lines=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const h=lines[0].split(";"); const iK=h.indexOf("stoch_k_m5_s0"),iD=h.indexOf("stoch_d_m5_s0");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type==="EXHAUSTION"&&s.side==="BUY"&&typeof s.R==="number"){
    const r=rows[s.i];if(!r)continue; const k=parseFloat(r[iK]),d=parseFloat(r[iD]);
    if(isNaN(k)||isNaN(d))continue; s._mk=k; s._kd=k-d; buy.push(s);}
}
const agg=s=>{const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);return `n${String(s.length).padStart(4)} WR${((w+ll)?w/(w+ll)*100:0).toFixed(0).padStart(3)}% avg${(s.length?R/s.length:0).toFixed(3).padStart(6)} R${(R>=0?"+":"")+R.toFixed(0)}`;};
console.log(`EXH BUY n=${buy.length} — bucket TOXIQUE (%K≥ligne & K−D<colonne) :`);
console.log("        K−D<0        K−D<-5       K−D<-10      K−D<-15");
for(const mk of [60,65,70,75,80]){
  const row=[0,-5,-10,-15].map(kd=>agg(buy.filter(s=>s._mk>=mk&&s._kd<kd)));
  console.log(`%K≥${mk}: `+row.join(" | "));
}
