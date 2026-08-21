const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json(); all=all.concat((j.signals||[]).filter(s=>typeof s.R==="number").map(s=>({...s,a}))); }
const sum=(s)=>s.reduce((x,y)=>x+y.R,0);
const wr=(s)=>{const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length;return (w+l)?w/(w+l)*100:0;};
// maxDD sur la courbe d'equity univers (trades triés par temps de sortie/ouverture)
const mdd=(s)=>{const o=[...s].sort((a,b)=>(a.tsMT||a.ts||"").localeCompare(b.tsMT||b.ts||""));let eq=0,pk=0,dd=0;for(const t of o){eq+=t.R;pk=Math.max(pk,eq);dd=Math.max(dd,pk-eq);}return dd;};
const cont=all.filter(s=>s.type!=="EXHAUSTION"), exh=all.filter(s=>s.type==="EXHAUSTION");
console.log(`UNIVERS n=${all.length} · R ${sum(all).toFixed(1)} · WR ${wr(all).toFixed(1)}% · maxDD ${mdd(all).toFixed(1)}`);
console.log(`  CONT  n=${cont.length} · R ${sum(cont).toFixed(1)} · WR ${wr(cont).toFixed(1)}%`);
console.log(`  EXH   n=${exh.length} · R ${sum(exh).toFixed(1)} · WR ${wr(exh).toFixed(1)}%`);
