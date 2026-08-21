const API = "http://localhost:3001/api/matrix";
const j = await (await fetch(`${API}/run/AUDUSD?maxOpen=30&cadenceMin=2`)).json();
const E = (j.signals||[]).filter(s=>s.type==="EXHAUSTION"&&typeof s.R==="number"&&s.adx>=30&&s.adx<40&&s.side==="SELL");
const byd={}; for(const s of E){const d=String(s.tsMT).slice(0,10);(byd[d]=byd[d]||[]).push(s);}
console.log(`AUDUSD EXH 30-40 SELL n=${E.length} — par JOUR :`);
for(const d of Object.keys(byd).sort()){const s=byd[d];const w=s.filter(x=>x.outcome==="WIN").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${d}: n ${String(s.length).padStart(2)} · ${w}W/${s.length-w}L · R ${(R>=0?"+":"")+R.toFixed(0)}`);}
