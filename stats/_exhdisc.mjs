const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets) { const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json(); all=all.concat((j.signals||[]).filter(s=>s.type==="EXHAUSTION"&&typeof s.R==="number")); }
const st=(s,l)=>{const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(22)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1)}% · avgR ${(s.length?R/s.length:0).toFixed(3)} · R ${(R>=0?"+":"")+R.toFixed(1)}`);};
console.log(`EXH total n=${all.length}`);
console.log("### par dominanceTurn (signe des 2 ΔADX)");
for(const d of ["RISING","FALLING","TURN_UP","TURN_DOWN","FLAT",null]) st(all.filter(s=>s.dominanceTurn===d), String(d));
console.log("### par niveau ADX");
const b=s=>{const a=s.adx;return a==null?"null":a<18?"<18":a<25?"18-25":a<35?"25-35":"≥35";};
for(const bb of ["<18","18-25","25-35","≥35","null"]) st(all.filter(s=>b(s)===bb), "ADX "+bb);
