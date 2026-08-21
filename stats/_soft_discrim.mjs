const API="http://localhost:3001/api/matrix";
const assets=await(await fetch(`${API}/assets`)).json();
const T=[];
for(const a of assets){const j=await(await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of(j.signals||[])){if((s.profile!=="Soft Bear"&&s.profile!=="Soft Bull")||typeof s.R!=="number")continue;
    T.push(s);}}
const wr=arr=>{const w=arr.filter(x=>x.outcome==="WIN").length,l=arr.filter(x=>x.outcome==="LOSS").length;return `WR ${(w+l?100*w/(w+l):0).toFixed(0)}% n=${arr.length} R ${(arr.reduce((a,x)=>a+x.R,0)>=0?"+":"")+arr.reduce((a,x)=>a+x.R,0).toFixed(0)}`;};
const bin=(name,fn,edges)=>{console.log(`\n── ${name} ──`);
  const buckets={};for(const s of T){const v=fn(s);if(v==null){(buckets["null"]??=[]).push(s);continue;}let lab="≥"+edges[edges.length-1];for(let i=0;i<edges.length;i++){if(v<edges[i]){lab=(i===0?"<":`[${edges[i-1]},`)+edges[i]+(i===0?"":")");break;}}(buckets[lab]??=[]).push(s);}
  for(const [k,arr] of Object.entries(buckets))console.log(`  ${k.padEnd(10)} ${wr(arr)}`);};
console.log("TOTAL Soft pullback :", wr(T));
bin("ADX (range<20 vs tendance)", s=>s.adx, [20,25,35,50]);
bin("dominanceTurn", s=>({RISING:2,FALLING:0,STABLE:1}[s.dominanceTurn]??null), [1,2]);
bin("|K−D H4| (H4 momentum)", s=>s.kdH4==null?null:Math.abs(s.kdH4), [3,8]);
bin("RSI H4 dist 50 (H4 stretch)", s=>s.rsiH4==null?null:Math.abs(s.rsiH4-50), [10,20]);
bin("forceScore (amplitude jour)", s=>s.forceScore, [25,50,75]);
// H4 aligné au trade ? SELL veut H4 bas (rsiH4<50), BUY veut H4 haut
console.log("\n── H4 aligné au SENS du trade ──");
const al=T.filter(s=>s.rsiH4!=null&&((s.side==="SELL"&&s.rsiH4<50)||(s.side==="BUY"&&s.rsiH4>=50)));
const ct=T.filter(s=>s.rsiH4!=null&&((s.side==="SELL"&&s.rsiH4>=50)||(s.side==="BUY"&&s.rsiH4<50)));
console.log("  aligné   ",wr(al));console.log("  contre   ",wr(ct));
