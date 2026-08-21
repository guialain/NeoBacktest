import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for(const a of assets){
  const lines=fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const iC1=lines[0].split(";").indexOf("adx14_h1_c1");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type==="EXHAUSTION"&&typeof s.R==="number"){const r=rows[s.i];if(!r)continue;const c1=+r[iC1];if(!isNaN(c1)){s._lvl=c1;s._a=a;all.push(s);}}
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(14)} n    0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(14)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(0).padStart(3)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0).padStart(5)}`);};
console.log(`EXH n=${all.length} — bandes ADX absolues (données COMPLÈTES) :`);
const b=[0,20,25,30,35,40,45,50,999];
for(let i=0;i<b.length-1;i++) st(all.filter(s=>s._lvl>=b[i]&&s._lvl<b[i+1]), `${b[i]}-${b[i+1]===999?"∞":b[i+1]}`);
const dz=all.filter(s=>s._lvl>=40&&s._lvl<50);
console.log(`\n### DEAD ZONE 40-50 (n=${dz.length}, R ${dz.reduce((a,b)=>a+b.R,0).toFixed(0)}) — spread ou cluster ?`);
console.log("par JOUR (top pertes) :");
const byd={}; for(const s of dz){const d=String(s.tsMT).slice(0,10);(byd[d]=byd[d]||[]).push(s);}
Object.entries(byd).map(([d,s])=>[d,s.reduce((a,b)=>a+b.R,0),s.length]).sort((x,y)=>x[1]-y[1]).slice(0,6).forEach(([d,R,n])=>console.log(`  ${d}: n${n} R ${R.toFixed(0)}`));
console.log("par ACTIF (top pertes) :");
const bya={}; for(const s of dz){(bya[s._a]=bya[s._a]||[]).push(s);}
Object.entries(bya).map(([a,s])=>[a,s.reduce((x,y)=>x+y.R,0),s.length]).sort((x,y)=>x[1]-y[1]).slice(0,6).forEach(([a,R,n])=>console.log(`  ${a}: n${n} R ${R.toFixed(0)}`));
