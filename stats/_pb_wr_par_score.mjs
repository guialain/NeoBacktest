// _pb_wr_par_score.mjs — LE SCORE PB TRIE-T-IL ? WR par VALEUR de score.
//
// ⭐⭐⭐ C'EST LA QUESTION PREALABLE A TOUT SEUIL : « un seuil suppose un score MONOTONE ». Si le WR
//   ne monte pas avec la note, aucune valeur de `ScoreMinValid_PB` n'a de sens — on choisirait un
//   point de coupe sur une courbe plate, c'est-a-dire a pile ou face.
// ⚠ ON TIRE TOUT (`MIN_PB` tres bas) : y compris les notes NEGATIVES et le RELAIS. C'est le seul
//   moyen de voir la courbe ENTIERE. Conditionner sur un seuil ne montrerait que sa moitie haute,
//   et c'est exactement le collider que ce depot documente partout.
// ⚠ Le score PB est QUANTIFIE sur 9 valeurs — on affiche donc par VALEUR EXACTE, pas par bande :
//   des bandes sur 9 valeurs melangeraient des cases qui ne disent pas la meme chose.
// ⚠ `sc.boxes.pb.conviction` et non `sc.exh` : la trace du rang ② reutilise les cles `exh*`, et
//   `boxes` est le seul champ dont la couverture a ete PROUVEE (926/926 le 10/08).
// ⚠ Une voix par grappe actif×jour — les tirs ne sont pas independants (sigma gonfle x9).
import fs from "fs"; import path from "path";
process.env.NO_TRIGGER = process.env.NO_TRIGGER ?? "1";
process.env.PB_ISOLE = "1";
process.env.MIN_PB = process.env.MIN_PB ?? "-11";   // tout tire, y compris les negatifs
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
const jour = s => String(s.tsMT||"").slice(0,10).replace(/\./g,"-");
const BE = 75;
const st = t => { if (!t.length) return null;
  const w = t.filter(x => x.outcome === "WIN").length, R = t.reduce((a,b) => a+(b.R||0), 0);
  const g = new Map();
  for (const x of t) { const k = x.asset+"|"+jour(x); if (!g.has(k)) g.set(k,{w:0,n:0});
    const o = g.get(k); o.n++; if (x.outcome === "WIN") o.w++; }
  const v = [...g.values()];
  return { n: t.length, wr: 100*w/t.length, R, gr: v.length,
           wrg: 100*v.reduce((a,b)=>a+b.w/b.n,0)/v.length, bas: v.filter(o=>o.w/o.n<BE/100).length }; };
const ligne = (lbl, t) => { const s = st(t);
  if (!s) { console.log("  " + lbl.padEnd(10) + "      —"); return; }
  console.log("  " + lbl.padEnd(10) + String(s.n).padStart(6) + s.wr.toFixed(1).padStart(8) + "%"
    + s.wrg.toFixed(1).padStart(9) + "%" + String(s.gr).padStart(6) + String(s.bas).padStart(5)
    + ((s.R>=0?"+":"")+s.R.toFixed(1)).padStart(9) + (s.R/s.n).toFixed(3).padStart(8)); };
const conv = s => s.sc?.boxes?.pb?.conviction;
const sansConv = PB.filter(s => !Number.isFinite(conv(s))).length;
console.log(`\n═══ PB · WR PAR VALEUR DE SCORE ═══  [PB_ISOLE=1 · MIN_PB=${process.env.MIN_PB} · spread FACTURE]`);
console.log(`  ${PB.length} tirs PB · conviction absente sur ${sansConv} ` + (sansConv ? "🔴" : "✅"));
console.log(`  ⚠ point mort 75,0 % — le score doit MONTER avec la note, sinon aucun seuil n'a de sens\n`);
console.log("  score       tirs   WR/tir  WR/grap  grap  <BE        R   R/tir");
const vals = [...new Set(PB.map(conv).filter(Number.isFinite))].sort((a,b)=>a-b);
for (const v of vals) ligne(String(v), PB.filter(s => conv(s) === v));
console.log("\n  ── cumulatif (score ≥ v) ──");
for (const v of vals) ligne("≥ " + v, PB.filter(s => conv(s) >= v));
