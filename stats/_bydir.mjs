const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for(const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(typeof s.R==="number") all.push(s); }
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(16)} n     0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(16)} n ${String(s.length).padStart(5)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0).padStart(6)}`);};
console.log("valeurs forceRegime:", [...new Set(all.map(s=>s.forceRegime))].join(" · "));
const order=["EXTREME_DOWN","STRONG_DOWN","SOFT_DOWN","NEUTRE","SOFT_UP","STRONG_UP","EXTREME_UP"];
const cont=all.filter(s=>s.type!=="EXHAUSTION"), exh=all.filter(s=>s.type==="EXHAUSTION");
console.log("\n═══ CONT par forceRegime ═══");
for(const r of order) st(cont.filter(s=>s.forceRegime===r), r);
console.log("═══ EXH par forceRegime ═══");
for(const r of order) st(exh.filter(s=>s.forceRegime===r), r);
console.log("\n─ regroupé DIR (signe) sur TOUT ─");
st(all.filter(s=>/UP/.test(s.forceRegime)),"UP (up)"); st(all.filter(s=>/DOWN/.test(s.forceRegime)),"DOWN"); st(all.filter(s=>s.forceRegime==="NEUTRE"),"NEUTRE (flat)");
