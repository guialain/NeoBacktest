import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for(const a of assets){
  const lines=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const iS=lines[0].split(";").indexOf("adx14_h1_s0");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(typeof s.R==="number"){
    const r=rows[s.i]; const s0=r?r[iS]:""; const hasS0=(s0!==""&&s0!=null&&!isNaN(parseFloat(s0)));
    if(hasS0) all.push({R:s.R,out:s.outcome,ts:s.tsMT,type:s.type,reason:s.reason}); }
}
const wr=s=>{const w=s.filter(x=>x.out==="WIN").length,l=s.filter(x=>x.out==="LOSS").length;return (w+l)?(w/(w+l)*100).toFixed(1):"--";};
const R=s=>s.reduce((a,b)=>a+b.R,0);
const mdd=s=>{const o=[...s].sort((a,b)=>a.ts.localeCompare(b.ts));let eq=0,pk=0,dd=0;for(const t of o){eq+=t.R;pk=Math.max(pk,eq);dd=Math.max(dd,pk-eq);}return dd;};
const days=[...new Set(all.map(s=>s.ts.slice(0,10)))].sort();
const C=all.filter(s=>s.type!=="EXHAUSTION"),E=all.filter(s=>s.type==="EXHAUSTION");
const oe=all.filter(s=>s.reason==="OPEN_END").length;
console.log(`═══ TRADES AVEC ADX s0 (deltaLive actif) — ${days[0]} → ${days[days.length-1]} ═══`);
console.log(`UNIVERS n=${all.length} · R ${R(all).toFixed(1)} · WR ${wr(all)}% · maxDD ${mdd(all).toFixed(1)} · avgR ${(R(all)/all.length).toFixed(3)}`);
console.log(`  CONT n=${C.length} · R ${R(C).toFixed(1)} · WR ${wr(C)}% · avgR ${(R(C)/C.length).toFixed(3)}`);
console.log(`  EXH  n=${E.length} · R ${R(E).toFixed(1)} · WR ${wr(E)}% · avgR ${(R(E)/E.length).toFixed(3)}`);
console.log(`  jours: ${days.length} · trades/jour: ${(all.length/days.length).toFixed(0)} · OPEN_END: ${oe}`);
console.log("par jour :");
for(const d of days){const g=all.filter(s=>s.ts.slice(0,10)===d);console.log(`  ${d}: n${String(g.length).padStart(4)} · R ${R(g).toFixed(1).padStart(6)} · WR ${wr(g)}%`);}
