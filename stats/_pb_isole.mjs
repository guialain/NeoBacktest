// _pb_isole.mjs — LE CARNET DU PULLBACK SEUL. `PB_ISOLE=1` + `MIN_PB=<n>`.
// ⚠ Les tirs EXH restent au carnet ET prennent leurs creneaux : le PB concourt contre eux comme en
//   vrai. On FILTRE a la lecture, on ne simule pas un moteur sans EXH — ce serait un mirage de capacite.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.PB_ISOLE = "1";
process.env.MIN_PB = process.env.MIN_PB ?? "10";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const { dedupeEpisodes } = await import("./_episodes.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const jour = s => String(s.tsMT||"").slice(0,10).replace(/\./g,"-");
const BE = 75;
const gr = t => { const g = new Map();
  for (const s of t) { const k = s.asset+"|"+jour(s); if (!g.has(k)) g.set(k,{w:0,n:0});
    const o=g.get(k); o.n++; if (s.outcome==="WIN") o.w++; }
  const v=[...g.values()];
  return { n:v.length, wr: v.length?100*v.reduce((a,b)=>a+b.w/b.n,0)/v.length:NaN, bas: v.filter(o=>o.w/o.n<BE/100).length }; };
const line = (lbl,t) => { if(!t.length){console.log("  "+lbl.padEnd(20)+"—");return;}
  const w=t.filter(x=>x.outcome==="WIN").length, R=t.reduce((a,b)=>a+(b.R||0),0), g=gr(t);
  console.log("  "+lbl.padEnd(20)+String(t.length).padStart(5)+" "+(100*w/t.length).toFixed(1).padStart(6)+"%"
    +" "+g.wr.toFixed(1).padStart(7)+"%"+String(g.n).padStart(5)+String(g.bas).padStart(5)
    +" "+((R>=0?"+":"")+R.toFixed(1)).padStart(8)+" "+(R/t.length).toFixed(3).padStart(7)); };
const fini = s => s.outcome==="WIN"||s.outcome==="LOSS";
const PB = all.filter(s => s.strategy==="PB" && fini(s));
const EX = all.filter(s => s.strategy==="EXH" && fini(s));
console.log(`\n════ PB ISOLE ════  MIN_PB=${process.env.MIN_PB} · PB_ISOLE=1 · NO_TRIGGER · spread FACTURE`);
console.log(`  ⚠ carnet NON comparable aux carnets EXH (la bande ambigue ne DROP plus)\n`);
console.log("  "+"".padEnd(20)+" tirs  WR/tir WR/grap  grap  <BE        R   R/tir");
line("PULLBACK — TOUS", PB); line("  BUY", PB.filter(s=>s.side==="BUY")); line("  SELL", PB.filter(s=>s.side==="SELL"));
line("  juillet", PB.filter(s=>jour(s)<"2026-08-01")); line("  aout", PB.filter(s=>jour(s)>="2026-08-01"));
console.log("");
line("(EXH, pour memoire)", EX);
const ep = dedupeEpisodes(all.filter(s=>s.strategy==="PB")).filter(fini);
console.log(`\n  episodes PB (dedup 15 min) : ${ep.length}`);
const pj = new Map(); for (const s of PB) { const k=s.asset+"|"+jour(s); pj.set(k,(pj.get(k)??0)+1); }
const v=[...pj.values()].sort((a,b)=>a-b);
console.log(`  volume PB : ${v.length?(PB.length/v.length).toFixed(1):0} tirs/actif/jour · p90 ${v.length?v[Math.floor(0.9*(v.length-1))]:0}`);
