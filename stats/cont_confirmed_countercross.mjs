// FILTRE CIBLÉ : WAIT le CONT si contre-cross H1 CONFIRMED (le contre-mouvement est réel et s'installe).
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
// recalcule crossoverState/Maturity H1 depuis la row (logique kdDynamics) — le contGate ne reçoit PAS det.
function h1kd(row) {
  const k = [0,1,2,3].map((o)=>num(row?.[`stoch_k_h1_s${o}`])), d = [0,1,2,3].map((o)=>num(row?.[`stoch_d_h1_s${o}`]));
  if (k.some((x)=>x==null)||d.some((x)=>x==null)) return null;
  const g = k.map((kk,o)=>kk-d[o]);
  let age=null; for (let o=0;o<3;o++) if (g[o]*g[o+1]<0){age=o;break;}
  if (age===null) return { state:"NONE", mat:null };
  const state = g[age]>0 ? "CROSS_UP" : "CROSS_DOWN";
  let mat="FRESH";
  if (age>=1){ let mono=true; for (let o=age;o>0;o--) if (Math.abs(g[o-1])<=Math.abs(g[o])){mono=false;break;} mat = mono?"CONFIRMED":"STALLED"; }
  return { state, mat };
}
const gate = (rows, i, sel) => {
  const kd = h1kd(rows[i]); if (!kd) return false;
  const cc = (sel.side === "BUY" && kd.state === "CROSS_DOWN") || (sel.side === "SELL" && kd.state === "CROSS_UP");
  return cc && kd.mat === "CONFIRMED";
};
function collect(withGate) {
  const byA = {}, byM = {}, all = [];
  for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
    const a = f.replace(/\.csv$/i, "");
    for (const s of (runMatrixBacktest(path.join(D, f), withGate ? { contGate: gate } : {}).signals || [])) {
      if (typeof s.R !== "number") continue; all.push(s);
      byA[a] = (byA[a] || 0) + s.R; const mo = String(s.tsMT).slice(0, 7); byM[mo] = (byM[mo] || 0) + s.R;
    }
  }
  const sorted = all.sort((x, y) => String(x.tsMT).localeCompare(String(y.tsMT))); let c = 0, p = 0, dd = 0; for (const s of sorted) { c += s.R; p = Math.max(p, c); dd = Math.max(dd, p - c); }
  const R = all.reduce((x, s) => x + s.R, 0), w = all.filter((s) => s.outcome === "WIN").length, l = all.filter((s) => s.outcome === "LOSS").length;
  return { byA, byM, R, dd, n: all.length, wr: w / (w + l) };
}
const b = collect(false), g = collect(true);
const f1 = (v) => (v >= 0 ? "+" : "") + v.toFixed(1);
console.log(`BASELINE : n=${b.n} totalR ${f1(b.R)} WR ${(b.wr*100).toFixed(1)}% maxDD ${b.dd.toFixed(1)} · R/DD ${(b.R/b.dd).toFixed(1)}`);
console.log(`FILTRÉ   : n=${g.n} totalR ${f1(g.R)} WR ${(g.wr*100).toFixed(1)}% maxDD ${g.dd.toFixed(1)} · R/DD ${(g.R/g.dd).toFixed(1)}   ΔR ${f1(g.R-b.R)} · ${b.n-g.n} CONT jetés`);
let pos = 0, neg = 0, zero = 0;
console.log(`\nΔR PAR ACTIF :`);
for (const a of Object.keys(b.byA).sort((x, y) => ((g.byA[x]||0)-b.byA[x]) - ((g.byA[y]||0)-b.byA[y]))) { const dR = (g.byA[a] || 0) - b.byA[a]; if (dR > 0.1) pos++; else if (dR < -0.1) neg++; else zero++; if (Math.abs(dR) > 0.1) console.log(`  ${a.padEnd(12)} ΔR ${f1(dR).padStart(7)}`); }
console.log(`  ⇒ ${pos} améliorés · ${neg} dégradés · ${zero} inchangés`);
console.log(`\nΔR PAR MOIS :`);
for (const mo of Object.keys(b.byM).sort()) console.log(`  ${mo}  ΔR ${f1((g.byM[mo]||0)-b.byM[mo])}`);
