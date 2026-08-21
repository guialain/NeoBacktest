import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const dir="data/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
// distribution ADX par actif
const dist={};
for(const a of assets){
  const L=fs.readFileSync(`${dir}/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const iC1=L[0].split(";").indexOf("adx14_h1_c1");
  dist[a]=L.slice(1).map(l=>parseFloat(l.split(";")[iC1])).filter(Number.isFinite).sort((x,y)=>x-y);
}
const pct=(a,v)=>{const arr=dist[a]; let lo=0,hi=arr.length; while(lo<hi){const m=(lo+hi)>>1; if(arr[m]<v)lo=m+1; else hi=m;} return lo/arr.length;};
let all=[];
for(const a of assets){
  const lines=fs.readFileSync(`${dir}/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>10);
  const iC1=lines[0].split(";").indexOf("adx14_h1_c1");
  const rows=lines.slice(1).map(l=>l.split(";"));
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type==="EXHAUSTION"&&typeof s.R==="number"){const r=rows[s.i];if(!r)continue;const c1=+r[iC1];if(!isNaN(c1)){s._pct=pct(a,c1);s._a=a;all.push(s);}}
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(16)} n    0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(16)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(0).padStart(3)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0)}`);};
console.log(`EXH n=${all.length} — par PERCENTILE ADX (relatif à l'actif) :`);
for(const[lo,hi,l]of[[0,.5,"<p50"],[.5,.75,"p50-75"],[.75,.85,"p75-85"],[.85,.95,"p85-95"],[.95,1.01,"≥p95"]]) st(all.filter(s=>s._pct>=lo&&s._pct<hi),l);
console.log("\n### contrôle AUDUSD : ses fades 30-40 tombent à quel percentile ?");
const aud=all.filter(s=>s._a==="AUDUSD");
st(aud.filter(s=>s._pct>=.75&&s._pct<.95),"AUD p75-95"); st(aud.filter(s=>s._pct<.75),"AUD <p75");
