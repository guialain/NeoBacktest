const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
const wr=s=>{const w=s.filter(x=>x.outcome==="WIN").length,l=s.filter(x=>x.outcome==="LOSS").length;return (w+l)?(w/(w+l)*100).toFixed(0):"--";};
const R=s=>s.reduce((a,b)=>a+b.R,0);
let bull=[],bear=[]; const rows=[];
for(const a of assets){ const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const sb=(j.signals||[]).filter(s=>s.profile==="Strong Bear"&&typeof s.R==="number");
  const su=(j.signals||[]).filter(s=>s.profile==="Strong Bull"&&typeof s.R==="number");
  rows.push({a,sb}); bear=bear.concat(sb); bull=bull.concat(su); }
rows.sort((x,y)=>R(y.sb)-R(x.sb));
console.log("STRONG BEAR SELL = LATE_BUY uniquement — par actif :");
console.log("actif".padEnd(12)+"  n    WR    R");
for(const {a,sb} of rows) if(sb.length) console.log(`${a.padEnd(12)} ${String(sb.length).padStart(3)}  ${wr(sb).padStart(3)}%  ${(R(sb)>=0?"+":"")+R(sb).toFixed(0)}`);
console.log("─".repeat(30));
console.log(`${"BEAR TOTAL".padEnd(12)} ${String(bear.length).padStart(3)}  ${wr(bear).padStart(3)}%  ${(R(bear)>=0?"+":"")+R(bear).toFixed(0)}`);
console.log(`${"BULL (rappel)".padEnd(12)} ${String(bull.length).padStart(3)}  ${wr(bull).padStart(3)}%  ${(R(bull)>=0?"+":"")+R(bull).toFixed(0)}`);
