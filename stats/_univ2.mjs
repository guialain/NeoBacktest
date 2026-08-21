const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[]; let sumR=0, sumW=0, sumL=0;
for (const a of assets){
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(typeof s.R==="number") all.push({R:s.R,out:s.outcome,exit:s.exitTs||s.tsMT||"",type:s.type});
}
const wr=(s)=>{const w=s.filter(x=>x.out==="WIN").length,l=s.filter(x=>x.out==="LOSS").length;return (w+l)?w/(w+l)*100:0;};
const sum=(s)=>s.reduce((x,y)=>x+y.R,0);
const mdd=(s)=>{const o=[...s].sort((a,b)=>a.exit.localeCompare(b.exit));let eq=0,pk=0,dd=0;for(const t of o){eq+=t.R;pk=Math.max(pk,eq);dd=Math.max(dd,pk-eq);}return dd;};
const cont=all.filter(s=>s.type!=="EXHAUSTION"), exh=all.filter(s=>s.type==="EXHAUSTION");
console.log(`UNIVERS n=${all.length} · R ${sum(all).toFixed(1)} · WR ${wr(all).toFixed(1)}% · maxDD(exit) ${mdd(all).toFixed(1)} R`);
console.log(`  CONT n=${cont.length} R ${sum(cont).toFixed(1)} WR ${wr(cont).toFixed(1)}% | EXH n=${exh.length} R ${sum(exh).toFixed(1)} WR ${wr(exh).toFixed(1)}%`);
