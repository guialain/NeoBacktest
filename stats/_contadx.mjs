import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for(const a of assets){
  const lines=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const iC1=lines[0].split(";").indexOf("adx14_h1_c1");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type!=="EXHAUSTION"&&typeof s.R==="number"){const r=rows[s.i]; if(!r)continue; const c1=+r[iC1]; if(!isNaN(c1)){s._lvl=c1; all.push(s);}}
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(12)} n     0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(12)} n ${String(s.length).padStart(5)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0).padStart(6)}`);};
console.log(`TOUT CONT n=${all.length} — par bande ADX(c1) :`);
for(const[lo,hi,l]of[[0,20,"<20"],[20,25,"20-25"],[25,30,"25-30"],[30,40,"30-40"],[40,50,"40-50"],[50,999,"≥50"]]) st(all.filter(s=>s._lvl>=lo&&s._lvl<hi),l);
console.log("\n### comparaison EXH vs CONT à 40-50 (le trou EXH) :");
