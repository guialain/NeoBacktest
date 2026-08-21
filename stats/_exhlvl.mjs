import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets) {
  const lines = fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>5);
  const h = lines[0].split(";"); const iC1=h.indexOf("adx14_h1_c1");
  const rows = lines.slice(1).map(l=>l.split(";"));
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])){
    if(s.type!=="EXHAUSTION"||typeof s.R!=="number") continue;
    const r=rows[s.i]; if(!r) continue; const c1=+r[iC1]; if(isNaN(c1)) continue;
    all.push({lvl:c1,R:s.R,out:s.outcome});
  }
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(12)} n    0`);return;}const w=s.filter(x=>x.out==="WIN").length,ll=s.filter(x=>x.out==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(12)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(1).padStart(6)}`);};
console.log(`TOUT EXH n=${all.length} — bandes fines ADX(c1)`);
const b=[0,20,25,30,35,40,45,50,999];
for(let i=0;i<b.length-1;i++) st(all.filter(s=>s.lvl>=b[i]&&s.lvl<b[i+1]), `${b[i]}-${b[i+1]===999?"∞":b[i+1]}`);
const R=s=>s.reduce((a,x)=>a+x.R,0);
console.log("\n— cumul : couper ADX ≥ X —");
for(const X of [30,35,40,45,50]){ const keep=all.filter(s=>s.lvl<X),drop=all.filter(s=>s.lvl>=X);
  console.log(`  garder <${X}: n ${String(keep.length).padStart(4)} R ${R(keep).toFixed(1).padStart(7)}  |  jeté ≥${X}: n ${String(drop.length).padStart(4)} R ${R(drop).toFixed(1).padStart(7)}`);}
