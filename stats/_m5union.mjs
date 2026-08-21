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
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(34)} n    0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(34)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(0).padStart(3)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0)}`);};
console.log(`EXH BUY n=${buy.length} :`);
const A=s=>s._mk>=80&&s._kd<0, B=s=>s._mk>=65&&s._kd<-5;
st(buy.filter(A),"A: %K≥80 & K−D<0");
st(buy.filter(B),"B: %K≥65 & K−D<−5");
st(buy.filter(s=>A(s)||B(s)),"UNION A∪B");
st(buy.filter(s=>!(A(s)||B(s))),"reste BUY (non bloqué)");
// variante diagonale simple : %K + (-K−D) ≥ seuil ? test seuil combiné
console.log("— alternative : règle diagonale %K − 3·(K−D) (M5 haut ET/OU bascule) —");
for(const T of [80,90,100]){ st(buy.filter(s=>s._kd<0 && (s._mk - 3*s._kd)>=T && s._mk>=60), `%K≥60 & K−D<0 & (%K−3·KD)≥${T}`); }
