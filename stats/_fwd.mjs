const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for(const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(typeof s.R==="number") all.push({R:s.R,out:s.outcome,ts:s.tsMT,type:s.type}); }
const win=all.filter(s=>s.ts>="2026.07.20");   // fenêtre OOS s0
const wr=s=>{const w=s.filter(x=>x.out==="WIN").length,l=s.filter(x=>x.out==="LOSS").length;return (w+l)?(w/(w+l)*100).toFixed(1):"--";};
const R=s=>s.reduce((a,b)=>a+b.R,0);
const mdd=s=>{const o=[...s].sort((a,b)=>a.ts.localeCompare(b.ts));let eq=0,pk=0,dd=0;for(const t of o){eq+=t.R;pk=Math.max(pk,eq);dd=Math.max(dd,pk-eq);}return dd;};
console.log(`═══ FORWARD/OOS 20-23/07 (s0 live, deltaLive ACTIF) ═══`);
const C=win.filter(s=>s.type!=="EXHAUSTION"),E=win.filter(s=>s.type==="EXHAUSTION");
console.log(`UNIVERS n=${win.length} · R ${R(win).toFixed(1)} · WR ${wr(win)}% · maxDD ${mdd(win).toFixed(1)}`);
console.log(`  CONT n=${C.length} · R ${R(C).toFixed(1)} · WR ${wr(C)}% · avgR ${(R(C)/C.length).toFixed(3)}`);
console.log(`  EXH  n=${E.length} · R ${R(E).toFixed(1)} · WR ${wr(E)}% · avgR ${(R(E)/E.length).toFixed(3)}`);
console.log("\npar jour :");
for(const d of ["2026.07.20","2026.07.21","2026.07.22","2026.07.23"]){
  const g=win.filter(s=>s.ts.slice(0,10)===d);
  console.log(`  ${d}: n${String(g.length).padStart(4)} · R ${R(g).toFixed(1).padStart(6)} · WR ${wr(g)}%`);
}
console.log(`\n─ repère IN-SAMPLE (22/06→20/07) : WR ~80-81 %, avgR CONT ~0,08 / EXH ~0,10 ─`);
