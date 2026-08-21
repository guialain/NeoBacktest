const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for(const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])) if(s.type==="EXHAUSTION"&&typeof s.R==="number"){s._a=a; all.push(s);} }
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(26)} n   0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(26)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(0).padStart(3)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(0)}`);};
const sell=all.filter(s=>s.adx>=30&&s.adx<40&&s.side==="SELL");
const aud=sell.filter(s=>s._a==="AUDUSD"), rest=sell.filter(s=>s._a!=="AUDUSD");
console.log("=== ADX 30-40 SELL : AUDUSD (mauvais) vs RESTE (bon) — quel observable diffère ? ===");
console.log("dominanceTurn (pente ADX) :");
for(const d of ["RISING","FALLING","TURN_UP","TURN_DOWN","FLAT"]){ const A=aud.filter(s=>s.dominanceTurn===d),Rr=rest.filter(s=>s.dominanceTurn===d); console.log(`  ${d.padEnd(10)} AUD n${A.length} | reste n${Rr.length}`); }
console.log("\ndiDelta (|+DI − −DI|) distribution :");
const q=(arr,f)=>{const v=arr.map(f).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?`méd ${v[Math.floor(v.length/2)].toFixed(1)} · p25 ${v[Math.floor(v.length*0.25)].toFixed(1)} · p75 ${v[Math.floor(v.length*0.75)].toFixed(1)}`:"—";};
console.log(`  AUD   : ${q(aud,s=>Math.abs(s.diDelta))}`);
console.log(`  reste : ${q(rest,s=>Math.abs(s.diDelta))}`);
console.log("\ndAdx (pente ADX brute) :");
console.log(`  AUD   : ${q(aud,s=>s.dAdx)}`);
console.log(`  reste : ${q(rest,s=>s.dAdx)}`);
console.log("\n### split diDelta (spread DI) sur TOUT le 30-40 SELL :");
for(const[lo,hi,l]of[[0,15,"<15"],[15,25,"15-25"],[25,999,"≥25"]]) st(sell.filter(s=>Math.abs(s.diDelta)>=lo&&Math.abs(s.diDelta)<hi),`diDelta ${l}`);
console.log("### split dAdx (ADX monte?) sur TOUT le 30-40 SELL :");
st(sell.filter(s=>s.dAdx>0),"dAdx>0 (ADX monte)"); st(sell.filter(s=>s.dAdx<=0),"dAdx≤0 (ADX baisse)");
