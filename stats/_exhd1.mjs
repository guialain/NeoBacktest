import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets) {
  const lines = fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split("\n");
  const h = lines[0].split(";"); const ix=(n)=>h.indexOf(n);
  const iC2=ix("adx14_h1_c2"),iC3=ix("adx14_h1_c3");
  const rows = lines.slice(1).filter(l=>l.length>10).map(l=>l.split(";"));
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])){
    if(s.type!=="EXHAUSTION"||typeof s.R!=="number") continue;
    const r=rows[s.i]; if(!r) continue;
    const c2=parseFloat(r[iC2]),c3=parseFloat(r[iC3]);
    s._d1 = (isNaN(c2)||isNaN(c3))?null:(c2-c3);   // delta récent aligné (shifté), dispo live
    all.push(s);
  }
}
const st=(s,l)=>{const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(20)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1)}% · avgR ${(s.length?R/s.length:0).toFixed(3)} · R ${(R>=0?"+":"")+R.toFixed(1)}`);};
console.log(`EXH par d1'=c2−c3 (delta récent aligné) — total n=${all.length}`);
st(all.filter(s=>s._d1!=null&&s._d1> 1.0), "d1' > +1  (ADX↑)");
st(all.filter(s=>s._d1!=null&&s._d1<=1.0&&s._d1>=-1.0), "d1' ∈[−1,+1] (plat)");
st(all.filter(s=>s._d1!=null&&s._d1< -1.0), "d1' < −1  (ADX↓)");
console.log("— seuils alternatifs (garder d1' ≤ X) —");
for(const X of [0.0,0.5,1.0,1.5]){ const keep=all.filter(s=>s._d1!=null&&s._d1<=X); const drop=all.filter(s=>s._d1!=null&&s._d1>X); const R=k=>k.reduce((a,b)=>a+b.R,0); console.log(`  garder d1'≤${X}: n ${keep.length} R ${R(keep).toFixed(1)}  |  jeté d1'>${X}: n ${drop.length} R ${R(drop).toFixed(1)}`); }
