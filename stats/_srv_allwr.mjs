const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const st = (s) => { const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0); return {n:s.length,wr:(w+l)?w/(w+l)*100:0,R}; };
const rows=[];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const sg=(j.signals||[]).filter(s=>typeof s.R==="number");
  rows.push({a, c:st(sg.filter(s=>s.type==="CONTINUATION")), e:st(sg.filter(s=>s.type==="EXHAUSTION")), t:st(sg)});
}
const fmt=(x)=>`${x.wr.toFixed(0)}% ${x.n} ${(x.R>=0?"+":"")+x.R.toFixed(0)}`;
console.log("actif".padEnd(12)+"CONT WR/n/R".padStart(19)+"EXH WR/n/R".padStart(19)+"TOUT WR/n/R".padStart(19));
for(const r of rows.sort((x,y)=>y.c.wr-x.c.wr)) console.log(r.a.padEnd(12)+fmt(r.c).padStart(19)+fmt(r.e).padStart(19)+fmt(r.t).padStart(19));
const sum=(k)=>rows.reduce((a,r)=>a+r[k].R,0);
console.log("─".repeat(69));
console.log(`TOTAL (serveur) CONT ${(sum("c")>=0?"+":"")+sum("c").toFixed(0)} · EXH ${(sum("e")>=0?"+":"")+sum("e").toFixed(0)} · TOUT ${(sum("t")>=0?"+":"")+sum("t").toFixed(0)}`);
