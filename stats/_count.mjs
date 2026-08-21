const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let opened=0, oe=0, tp=0, sl=0, to=0, days=new Set();
for(const a of assets){
  const j=await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  const s=j.summary;
  opened+=s.opened;
  for(const sig of (j.signals||[])){
    if(sig.reason==="OPEN_END")oe++;
    if(sig.reason==="TP")tp++; if(sig.reason==="SL")sl++; if(sig.reason==="TIMEOUT")to++;
    if(sig.tsMT) days.add(String(sig.tsMT).slice(0,10));
  }
}
const nd=days.size;
console.log(`Période : ${[...days].sort()[0]} → ${[...days].sort().pop()}  (${nd} jours de marché)`);
console.log(`Trades OUVERTS (univers, 19 actifs) : ${opened}`);
console.log(`  → par jour : ${(opened/nd).toFixed(0)} · par actif/jour : ${(opened/nd/19).toFixed(1)}`);
console.log(`Résolution : TP ${tp} · SL ${sl} · TIMEOUT ${to} · OPEN_END ${oe} (${(100*oe/opened).toFixed(2)}% non résolus)`);
