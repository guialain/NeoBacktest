const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const wr=s=>{const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length;return (w+l)?(w/(w+l)*100):0;};
const R=s=>s.reduce((a,b)=>a+b.R,0);
const rows=[];
for(const a of assets){
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const sig=(j.signals||[]).filter(s=>typeof s.R==="number");
  const C=sig.filter(s=>s.type!=="EXHAUSTION"), E=sig.filter(s=>s.type==="EXHAUSTION");
  rows.push({a,C,E});
}
rows.sort((x,y)=>R(y.C)+R(y.E)-(R(x.C)+R(x.E)));
console.log("actif".padEnd(12)+" | "+"CONT  n   WR     R".padEnd(24)+" | EXH   n   WR     R");
console.log("─".repeat(64));
let tC=[],tE=[];
for(const {a,C,E} of rows){
  tC=tC.concat(C); tE=tE.concat(E);
  const c=`${String(C.length).padStart(4)} ${wr(C).toFixed(1).padStart(5)}% ${(R(C)>=0?"+":"")+R(C).toFixed(0)}`.padEnd(22);
  const e=`${String(E.length).padStart(4)} ${wr(E).toFixed(1).padStart(5)}% ${(R(E)>=0?"+":"")+R(E).toFixed(0)}`;
  console.log(`${a.padEnd(12)} | ${c} | ${e}`);
}
console.log("─".repeat(64));
console.log(`${"TOTAL".padEnd(12)} | ${String(tC.length).padStart(4)} ${wr(tC).toFixed(1).padStart(5)}% ${"+"+R(tC).toFixed(0)}`.padEnd(37)+` | ${String(tE.length).padStart(4)} ${wr(tE).toFixed(1).padStart(5)}% ${"+"+R(tE).toFixed(0)}`);
