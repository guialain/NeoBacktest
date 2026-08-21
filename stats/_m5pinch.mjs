import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let buy=[],sell=[];
for(const a of assets){
  const lines=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const h=lines[0].split(";"); const iK=h.indexOf("stoch_k_m5_s0"),iD=h.indexOf("stoch_d_m5_s0");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type==="EXHAUSTION"&&typeof s.R==="number"){
    const r=rows[s.i];if(!r)continue; const k=parseFloat(r[iK]),d=parseFloat(r[iD]);
    if(isNaN(k)||isNaN(d))continue; s._mk=k; s._kd=k-d;
    (s.side==="BUY"?buy:sell).push(s);}
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(30)} n    0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(30)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(0).padStart(3)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0)}`);};
console.log(`EXH BUY n=${buy.length} — PINCEMENT (%K≥80 & |K−D|<seuil) :`);
for(const T of [2,3]){ st(buy.filter(s=>s._mk>=80&&Math.abs(s._kd)<T), `%K≥80 & |K−D|<${T}`); }
st(buy.filter(s=>s._mk>=80&&s._kd<0), "réf : %K≥80 & K<D");
console.log(`EXH SELL n=${sell.length} — miroir (%K≤20 & |K−D|<seuil) :`);
for(const T of [2,3]){ st(sell.filter(s=>s._mk<=20&&Math.abs(s._kd)<T), `%K≤20 & |K−D|<${T}`); }
console.log("reste (non bloqué, union BUY|K−D|<3 + SELL) :");
st(buy.filter(s=>!(s._mk>=80&&Math.abs(s._kd)<3)), "reste BUY");
