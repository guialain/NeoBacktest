import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets) {
  const lines = fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>5);
  const h = lines[0].split(";"); const ix=n=>h.indexOf(n);
  const r0=ix("rsi_h1_s0"),r1=ix("rsi_h1_s1"),r2=ix("rsi_h1_s2"),iC1=ix("adx14_h1_c1");
  const rows = lines.slice(1).map(l=>l.split(";"));
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])){
    if(s.type!=="EXHAUSTION"||typeof s.R!=="number") continue;
    const r=rows[s.i]; if(!r) continue;
    const rr0=+r[r0],rr1=+r[r1],rr2=+r[r2],c1=+r[iC1]; if([rr0,rr1,c1].some(isNaN)) continue;
    const dS0=rr0-rr1;                          // dRSI frais (s0-s1)
    const dCl=isNaN(rr2)?null:(rr1-rr2);        // dRSI closed (s1-s2)
    const sgn=s.side==="SELL"?1:-1;             // "continue la tendance fadée" : SELL→dRSI>0, BUY→dRSI<0
    s._contS0=dS0*sgn; s._contCl=dCl==null?null:dCl*sgn; s._lvl=c1;
    all.push(s);
  }
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(24)} n    0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(24)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(1)}`);};
for(const [key,lab] of [["_contS0","dRSI FRAIS s0−s1"],["_contCl","dRSI CLOSED s1−s2"]]){
  console.log(`\n═══ ${lab} — « continue » = RSI dans le sens de la tendance fadée ═══`);
  const v=all.filter(s=>s[key]!=null);
  console.log("ALL:");
  st(v.filter(s=>s[key]>0), "RSI continue (skip?)");
  st(v.filter(s=>s[key]<0), "RSI tourne (fade ok)");
  for(const [lo,hi,L] of [[0,40,"ADX <40"],[40,999,"ADX ≥40"]]){
    const g=v.filter(s=>s._lvl>=lo&&s._lvl<hi);
    console.log(`${L}:`);
    st(g.filter(s=>s[key]>0), " RSI continue");
    st(g.filter(s=>s[key]<0), " RSI tourne");
  }
}
