import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets) {
  const lines = fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split("\n");
  const h = lines[0].split(";"); const ix=(n)=>h.indexOf(n);
  const iC1=ix("adx14_h1_c1"),iC2=ix("adx14_h1_c2"),iC3=ix("adx14_h1_c3");
  const rows = lines.slice(1).filter(l=>l.length>10).map(l=>l.split(";"));
  const seq=[]; let last=null; const rowK=[];
  for(const r of rows){ const c1=parseFloat(r[iC1]); if(!isNaN(c1)&&c1!==last){ seq.push(c1); last=c1; } rowK.push(seq.length-1); }
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])){
    if(s.type!=="EXHAUSTION"||typeof s.R!=="number") continue;
    const r=rows[s.i]; if(!r) continue;
    const c2=parseFloat(r[iC2]),c3=parseFloat(r[iC3]);
    const k=rowK[s.i]; const c4 = k-3>=0 ? seq[k-3] : null;
    // produit DÉCALÉ (owner) : delta1'=(c2-c3), delta2'=(c3-c4)
    s._prodSH = (c4!=null&&!isNaN(c2)&&!isNaN(c3)) ? (c2-c3)*(c3-c4) : null;
    all.push(s);
  }
}
const st=(s,l)=>{const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(28)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1)}% · avgR ${(s.length?R/s.length:0).toFixed(3)} · R ${(R>=0?"+":"")+R.toFixed(1)}`);};
console.log(`EXH par produit ΔADX DÉCALÉ (c2−c3)×(c3−c4) — total n=${all.length}`);
st(all.filter(s=>s._prodSH!=null&&s._prodSH<0), "produit < 0  (TURN/inflexion)");
st(all.filter(s=>s._prodSH!=null&&s._prodSH>0), "produit > 0  (pas de turn)");
st(all.filter(s=>s._prodSH==null||s._prodSH===0), "nul / indéfini");
console.log("— comparaison NON-décalé (c1−c2)×(c2−c3) pour référence —");
