// L'expert ZScore EXH parle-t-il seulement ? (owner 2026-08-02)
// ⚠ Un barème neutre à la mesure a DEUX explications : il est sans effet, ou il ne s'exprime jamais.
//   Sans ce comptage on attribue à « le barème plafonne » ce qui est peut-être « l'expert est muet ».
const API = "http://localhost:3001/api/matrix";
const assets = await (await fetch(`${API}/assets`)).json();
let exh = 0, parle = 0, nz = 0; const vals = [];
const parExp = {};
for (const a of assets) {
  const j = await (await fetch(`${API}/run/${a}?maxOpen=30&cadenceMin=2`)).json();
  for (const s of (j.signals || [])) {
    if (s.type !== "EXHAUSTION" || typeof s.R !== "number") continue;
    exh++;
    const e = s.sc?.exp || {};
    for (const [k, v] of Object.entries(e)) { (parExp[k] ??= { n: 0, nz: 0 }); if (v !== null && Number.isFinite(v)) { parExp[k].n++; if (v !== 0) parExp[k].nz++; } }
    const z = e.zscore;
    if (z !== null && Number.isFinite(z)) { parle++; if (z !== 0) { nz++; vals.push(z); } }
  }
}
console.log(`fades = ${exh}`);
console.log(`ZScore EXH s'exprime (non-null) : ${parle}  =  ${(parle/exh*100).toFixed(1)} %`);
console.log(`             ... et non nul      : ${nz}  =  ${(nz/exh*100).toFixed(1)} %\n`);
if (vals.length) { vals.sort((a,b)=>a-b);
  const q=(p)=>vals[Math.min(vals.length-1,Math.floor(vals.length*p))];
  console.log(`valeurs non nulles : min ${q(0).toFixed(2)} · p25 ${q(.25).toFixed(2)} · med ${q(.5).toFixed(2)} · p75 ${q(.75).toFixed(2)} · max ${q(1).toFixed(2)}\n`); }
console.log(`${"expert".padEnd(10)}${"s'exprime".padStart(12)}${"non nul".padStart(12)}`);
for (const [k, v] of Object.entries(parExp))
  console.log(`${k.padEnd(10)}${(v.n/exh*100).toFixed(1).padStart(11)}%${(v.nz/exh*100).toFixed(1).padStart(11)}%`);
