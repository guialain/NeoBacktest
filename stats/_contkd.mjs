import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let buy=[],sell=[];
for(const a of assets){
  const lines=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const h=lines[0].split(";"); const iK=h.indexOf("stoch_k_h1_s0"),iD=h.indexOf("stoch_d_h1_s0");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type!=="EXHAUSTION"&&typeof s.R==="number"){
    const r=rows[s.i];if(!r)continue; const k=parseFloat(r[iK]),d=parseFloat(r[iD]);
    if(isNaN(k)||isNaN(d))continue; s._kd=k-d; (s.side==="BUY"?buy:sell).push(s);}
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(18)} n     0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(18)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0).padStart(5)}`);};
const bands=[[-999,-14,"< −14 (P10)"],[-14,-7,"−14..−7"],[-7,-0.7,"−7..−0,7"],[-0.7,7,"−0,7..+7"],[7,14,"+7..+14"],[14,999,"> +14 (P90)"]];
console.log(`═══ CONT BUY n=${buy.length} par K−D H1 s0 ═══`);
for(const[lo,hi,l]of bands) st(buy.filter(s=>s._kd>=lo&&s._kd<hi),l);
console.log(`═══ CONT SELL n=${sell.length} par K−D H1 s0 ═══`);
for(const[lo,hi,l]of bands) st(sell.filter(s=>s._kd>=lo&&s._kd<hi),l);
