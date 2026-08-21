const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let nullKd=[], okKd=[];
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals||[])) {
    if (s.type!=="CONTINUATION" || typeof s.R!=="number") continue;
    (s.kdH1==null ? nullKd : okKd).push(s);
  }
}
const st=(s,l)=>{const w=s.filter(x=>x.outcome==="WIN").length,ll=s.filter(x=>x.outcome==="LOSS").length,R=s.reduce((a,b)=>a+b.R,0);console.log(`  ${l.padEnd(28)} n ${String(s.length).padStart(4)} · WR ${((w+ll)?w/(w+ll)*100:0).toFixed(1)}% · avgR ${(s.length?R/s.length:0).toFixed(3)} · R ${(R>=0?"+":"")+R.toFixed(1)}`);};
console.log("=== CONT : K/D présent vs NULL (serveur) ===");
st(okKd,"K/D présent");
st(nullKd,"K/D NULL (aveugle)");
