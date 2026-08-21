const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let bull=[],bear=[];
for(const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(typeof s.R==="number"){
    if(s.profile==="Strong Bull") bull.push(s); if(s.profile==="Strong Bear") bear.push(s);} }
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(18)} n   0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(18)} n ${String(s.length).padStart(3)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(0).padStart(3)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0)}`);};
const m=(s,mo)=>s.filter(x=>String(x.tsMT).slice(0,7)===mo);
console.log("STRONG BULL BUY=LATE_SELL par mois :");
st(m(bull,"2026.06"),"juin"); st(m(bull,"2026.07"),"juillet"); st(bull,"TOTAL");
console.log("STRONG BEAR SELL=LATE_BUY par mois :");
st(m(bear,"2026.06"),"juin"); st(m(bear,"2026.07"),"juillet"); st(bear,"TOTAL");
