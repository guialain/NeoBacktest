import fs from "fs";
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let all=[];
for (const a of assets) {
  const lines = fs.readFileSync(`data/matrix/${a}.csv`,"utf8").split(/\r?\n/).filter(x=>x.length>5);
  const h = lines[0].split(";"); const ix=n=>h.indexOf(n);
  const iC1=ix("adx14_h1_c1"),iC2=ix("adx14_h1_c2"),iC3=ix("adx14_h1_c3"),iC4=ix("adx14_h1_c4");
  const rows = lines.slice(1).map(l=>l.split(";"));
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for(const s of (j.signals||[])){
    if(s.type!=="EXHAUSTION"||typeof s.R!=="number") continue;
    const r=rows[s.i]; if(!r) continue;
    const c1=parseFloat(r[iC1]),c2=parseFloat(r[iC2]),c3=parseFloat(r[iC3]),c4=parseFloat(r[iC4]);
    if([c1,c2,c3].some(isNaN)) continue;
    s._lvl=c1; s._prod=isNaN(c4)?null:(c2-c3)*(c3-c4);   // niveau = dernière close · turn décalé
    all.push(s);
  }
}
const st=(s,l)=>{if(!s.length){console.log(`  ${l.padEnd(16)} n    0`);return;}const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(16)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1).padStart(5)}% · avgR ${(R/s.length).toFixed(3).padStart(6)} · R ${(R>=0?"+":"")+R.toFixed(1)}`);};
console.log(`TOUT EXH (age-1 gate OFF) n=${all.length} — par niveau ADX (c1) × turn décalé (c2-c3)(c3-c4)`);
for(const [lo,hi,lab] of [[0,20,"ADX <20"],[20,30,"ADX 20-30"],[30,40,"ADX 30-40"],[40,999,"ADX ≥40"]]){
  const g=all.filter(s=>s._lvl>=lo&&s._lvl<hi&&s._prod!=null);
  console.log(`\n### ${lab}  (n=${g.length})`);
  st(g.filter(s=>s._prod<0), "TURN (prod<0)");
  st(g.filter(s=>s._prod>0), "pas turn (>0)");
  const aR=x=>x.length?x.reduce((a,b)=>a+b.R,0)/x.length:0;
  const dT=g.filter(s=>s._prod<0),dN=g.filter(s=>s._prod>0);
  console.log(`  → écart avgR turn−pasturn : ${(aR(dT)-aR(dN)>=0?"+":"")+(aR(dT)-aR(dN)).toFixed(3)}`);
}
