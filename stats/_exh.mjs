const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const st=(s)=>{const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);return{n:s.length,wr:(w+l)?w/(w+l)*100:0,R};};
const rows=[]; let allE=[];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const e=(j.signals||[]).filter(s=>s.type==="EXHAUSTION"&&typeof s.R==="number");
  allE=allE.concat(e);
  rows.push({a, all:st(e), buy:st(e.filter(s=>s.side==="BUY")), sell:st(e.filter(s=>s.side==="SELL"))});
}
const f=(x)=>`${x.wr.toFixed(0)}%·${x.n}·${(x.R>=0?"+":"")+x.R.toFixed(0)}`;
console.log("actif".padEnd(12)+"EXH tot".padStart(15)+"BUY(fade bas)".padStart(16)+"SELL(fade haut)".padStart(16));
for(const r of rows.sort((x,y)=>y.all.R-x.all.R)) console.log(r.a.padEnd(12)+f(r.all).padStart(15)+f(r.buy).padStart(16)+f(r.sell).padStart(16));
console.log("─".repeat(59));
const byMat=(m)=>st(allE.filter(s=>s.crossMat===m));
console.log(`EXH total: ${(st(allE).R).toFixed(0)} R · par maturité: FRESH ${byMat("FRESH").wr.toFixed(0)}%/${byMat("FRESH").R.toFixed(0)} · CONFIRMED ${byMat("CONFIRMED").wr.toFixed(0)}%/${byMat("CONFIRMED").R.toFixed(0)}`);
