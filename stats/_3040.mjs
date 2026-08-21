const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for(const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type==="EXHAUSTION"&&typeof s.R==="number"){s._a=a; all.push(s);} }
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(24)} n   0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(24)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(0).padStart(3)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0)}`);};
const b3040=all.filter(s=>s.adx>=30&&s.adx<40);
console.log(`### TOUT EXH ADX 30-40 (n=${b3040.length}) par SIDE`);
st(b3040.filter(s=>s.side==="BUY"),"BUY"); st(b3040.filter(s=>s.side==="SELL"),"SELL");
console.log(`### ADX 30-40 SELL : AUDUSD vs le RESTE`);
st(b3040.filter(s=>s.side==="SELL"&&s._a==="AUDUSD"),"AUDUSD"); st(b3040.filter(s=>s.side==="SELL"&&s._a!=="AUDUSD"),"reste");
console.log(`### ADX 30-40 SELL — par DI : +DI domine (uptrend fort) vs -DI`);
const sell=b3040.filter(s=>s.side==="SELL");
st(sell.filter(s=>s.plusDi>s.minusDi),"+DI>−DI (uptrend)"); st(sell.filter(s=>s.plusDi<=s.minusDi),"−DI≥+DI (downtrend)");
console.log(`### ADX 30-40 SELL — par slopeD1 (pente daily) signe`);
st(sell.filter(s=>s.slopeD1>0),"daily UP (slopeD1>0)"); st(sell.filter(s=>s.slopeD1<=0),"daily DOWN/flat");
console.log(`### contrôle : AUDUSD 30-40 SELL — +DI vs -DI`);
const aus=sell.filter(s=>s._a==="AUDUSD");
st(aus.filter(s=>s.plusDi>s.minusDi),"AUD +DI>−DI"); st(aus.filter(s=>s.plusDi<=s.minusDi),"AUD −DI≥+DI");
