import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets) {
  const lines = fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>5);
  const iC1=lines[0].split(";").indexOf("adx14_h1_c1");
  const rows = lines.slice(1).map(l=>l.split(";"));
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])){
    if(s.type!=="EXHAUSTION"||typeof s.R!=="number") continue;
    const r=rows[s.i]; if(!r) continue; const c1=+r[iC1]; if(isNaN(c1)) continue;
    const z=s.zoneH1;                       // zone %K H1 au signal
    const extreme = z==="EXTREME_HAUTE"||z==="EXTREME_BASSE";
    s._lvl=c1; s._ext=extreme; s._z=z;
    all.push(s);
  }
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(18)} n    0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(18)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(1).padStart(6)}`);};
console.log(`EXH n=${all.length} — distribution zones : ${[...new Set(all.map(s=>s._z))].join(", ")}`);
console.log("\n═══ EXTRÊME vs HAUTE/BASSE (non-extrême), global ═══");
st(all.filter(s=>s._ext),"EXTRÊME");
st(all.filter(s=>!s._ext),"HAUTE/BASSE");
for(const [lo,hi,L] of [[0,40,"ADX <40"],[40,50,"ADX 40-50"],[50,999,"ADX ≥50"]]){
  const g=all.filter(s=>s._lvl>=lo&&s._lvl<hi);
  console.log(`\n### ${L} (n=${g.length})`);
  st(g.filter(s=>s._ext),"EXTRÊME");
  st(g.filter(s=>!s._ext),"HAUTE/BASSE");
}
