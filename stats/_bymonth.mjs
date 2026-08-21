const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json(); for(const s of (j.signals||[])) if(typeof s.R==="number") all.push({R:s.R,out:s.outcome,m:(s.tsMT||s.exitTs||"").slice(0,7),type:s.type}); }
const months=[...new Set(all.map(s=>s.m))].filter(Boolean).sort();
const R=(s)=>s.reduce((x,y)=>x+y.R,0);
const wr=(s)=>{const w=s.filter(x=>x.out==="WIN").length,l=s.filter(x=>x.out==="LOSS").length;return (w+l)?(w/(w+l)*100).toFixed(1):"--";};
for(const m of months){
  const M=all.filter(s=>s.m===m), E=M.filter(s=>s.type==="EXHAUSTION"), C=M.filter(s=>s.type!=="EXHAUSTION");
  console.log(`${m}: UNIV n${M.length} R ${R(M).toFixed(1)} WR ${wr(M)}% | EXH n${E.length} R ${R(E).toFixed(1)} WR ${wr(E)}% | CONT n${C.length} R ${R(C).toFixed(1)}`);
}
console.log(`TOTAL: UNIV ${R(all).toFixed(1)} | EXH ${R(all.filter(s=>s.type==="EXHAUSTION")).toFixed(1)} | CONT ${R(all.filter(s=>s.type!=="EXHAUSTION")).toFixed(1)}`);
