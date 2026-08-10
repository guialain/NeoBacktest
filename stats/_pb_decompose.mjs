// _pb_decompose.mjs — DE QUOI EST FAITE UNE VALEUR DE SCORE PB ?
//
// 🔴 LE PROBLEME : le score `13` porte **R −146,9 sur 1 236 tirs**, la moitie du deficit du carnet
//   PB. Mais `13` n'est pas UNE figure : c'est `z8+k5`, `z10+k3`, `z5+k8`, `z3+k10`… — des couples
//   qui n'ont en commun que leur SOMME. J'ai devine lequel trainait (`z10+k3`) : REFUTE, la poche
//   n'a pas bouge d'un dixieme quand on a baisse cette case.
// ⇒ On DECOMPOSE au lieu de deviner. `sc.boxes.pb.parts` porte la note de chaque entree.
//
// ⚠ On regarde AUSSI les cases prises isolement (marges) : une case peut etre mauvaise partout, ou
//   seulement dans une combinaison. Les deux se corrigent differemment.
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.PB_ISOLE = "1";
process.env.MIN_PB = process.env.MIN_PB ?? "-11";
const CIBLE = process.env.SCORE ? Number(process.env.SCORE) : 13;
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const DIR = "C:/Users/Public/Neo-Backtest/data/matrix";
let all = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith(".csv"))) {
  const a = path.basename(f, ".csv");
  const r = runMatrixBacktest(path.join(DIR, f), { maxOpen: 30, cadenceMin: 2, chargeSpread: true });
  for (const s of (r.signals || [])) if (typeof s.R === "number") all.push({ ...s, asset: a });
}
const fini = s => s.outcome === "WIN" || s.outcome === "LOSS";
const PB = all.filter(s => s.strategy === "PB" && fini(s));
const P = s => s.sc?.boxes?.pb?.parts;
const sansParts = PB.filter(s => !P(s)).length;
console.log(`\n═══ DECOMPOSITION DU SCORE PB ═══  [PB_ISOLE=1 · cible = ${CIBLE}]`);
console.log(`  ${PB.length} tirs PB · \`parts\` absent sur ${sansParts} ` + (sansParts ? "🔴 NE PAS CONCLURE" : "✅"));
if (sansParts) process.exit(1);
const jour = s => String(s.tsMT||"").slice(0,10).replace(/\./g,"-");
const BE = 75;
const st = t => { if (!t.length) return null;
  const w = t.filter(x => x.outcome === "WIN").length, R = t.reduce((a,b)=>a+(b.R||0),0);
  const g = new Map();
  for (const x of t) { const k = x.asset+"|"+jour(x); if (!g.has(k)) g.set(k,{w:0,n:0});
    const o = g.get(k); o.n++; if (x.outcome==="WIN") o.w++; }
  const v = [...g.values()];
  return { n:t.length, wr:100*w/t.length, R, gr:v.length,
           wrg:100*v.reduce((a,b)=>a+b.w/b.n,0)/v.length }; };
const ligne = (lbl,t) => { const s = st(t); if (!s) return;
  console.log("  " + lbl.padEnd(26) + String(s.n).padStart(6) + s.wr.toFixed(1).padStart(8) + "%"
    + s.wrg.toFixed(1).padStart(9) + "%" + String(s.gr).padStart(6)
    + ((s.R>=0?"+":"")+s.R.toFixed(1)).padStart(9) + (s.R/s.n).toFixed(3).padStart(8)); };
const ENT = "  " + "".padEnd(26) + "  tirs   WR/tir  WR/grap  grap        R   R/tir";

const cible = PB.filter(s => s.sc?.boxes?.pb?.conviction === CIBLE);
console.log(`\n── LES COUPLES (z, %K) QUI SOMMENT A ${CIBLE} ──  ${cible.length} tirs\n` + ENT);
const couples = new Map();
for (const s of cible) { const p = P(s); const k = `z${p.z} + k${p.k}`;
  if (!couples.has(k)) couples.set(k, []); couples.get(k).push(s); }
for (const [k,t] of [...couples.entries()].sort((a,b)=>b[1].length-a[1].length)) ligne(k, t);

console.log(`\n── LES MEMES COUPLES, MAIS SUR TOUT LE CARNET (la case est-elle mauvaise PARTOUT ?) ──\n` + ENT);
for (const [k] of [...couples.entries()].sort((a,b)=>b[1].length-a[1].length)) {
  const [zc,kc] = k.match(/z(-?\d+) \+ k(-?\d+)/).slice(1).map(Number);
  ligne(k, PB.filter(s => P(s).z === zc && P(s).k === kc));
}
console.log(`\n── MARGES : chaque note de z seule, puis chaque note de %K seule ──\n` + ENT);
for (const v of [...new Set(PB.map(s=>P(s).z))].sort((a,b)=>a-b)) ligne(`z = ${v}`, PB.filter(s=>P(s).z===v));
console.log("");
for (const v of [...new Set(PB.map(s=>P(s).k))].sort((a,b)=>a-b)) ligne(`%K = ${v}`, PB.filter(s=>P(s).k===v));
