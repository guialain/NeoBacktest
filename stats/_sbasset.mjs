const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const wr=s=>{const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length;return (w+l)?(w/(w+l)*100).toFixed(0):"--";};
const R=s=>s.reduce((a,b)=>a+b.R,0);
let tot=[]; const rows=[];
for(const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const sb=(j.signals||[]).filter(s=>s.profile==="Strong Bull"&&typeof s.R==="number");
  rows.push({a,sb}); tot=tot.concat(sb); }
rows.sort((x,y)=>R(y.sb)-R(x.sb));
console.log(`STRONG BULL BUY = LATE_SELL uniquement — par actif :`);
console.log("actif".padEnd(12)+"  n    WR    R");
for(const {a,sb} of rows) if(sb.length) console.log(`${a.padEnd(12)} ${String(sb.length).padStart(3)}  ${wr(sb).padStart(3)}%  ${(R(sb)>=0?"+":"")+R(sb).toFixed(0)}`);
console.log("─".repeat(30));
console.log(`${"TOTAL".padEnd(12)} ${String(tot.length).padStart(3)}  ${wr(tot).padStart(3)}%  ${(R(tot)>=0?"+":"")+R(tot).toFixed(0)}`);
