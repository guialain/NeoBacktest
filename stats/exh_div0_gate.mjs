// ÉTUDE : div0>0 (ou gap0≥seuil) comme porte EXH supplémentaire (owner 2026-07-21, cas US_30 12h).
//   Le frôlement (cross mou, |gap| collé) passe les portes actuelles. div0<0 au tir = les lignes
//   convergent ENCORE juste après le cross = aller-retour probable. Mesure sur l'univers.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
function gd(row) {
  const k0 = num(row?.stoch_k_h1_s0), d0 = num(row?.stoch_d_h1_s0), k1 = num(row?.stoch_k_h1_s1), d1 = num(row?.stoch_d_h1_s1);
  if ([k0, d0, k1, d1].some((x) => x == null)) return null;
  const g0 = Math.abs(k0 - d0), g1 = Math.abs(k1 - d1);
  return { gap0: g0, div0: g0 - g1 };
}
const adxOf = (rows, i) => num(rows[i]?.adx14_h1_s0) ?? num(rows[i]?.adx14_h1_c1);
const V = {
  "div0>0 (partout)":       (rows, i) => { const o = gd(rows[i]); return o != null && !(o.div0 > 0); },
  "div0>0 (ADX<40 seul)":   (rows, i) => { const o = gd(rows[i]); const a = adxOf(rows, i); return o != null && a != null && a < 40 && !(o.div0 > 0); },
  "gap0≥6 (partout)":       (rows, i) => { const o = gd(rows[i]); return o != null && !(o.gap0 >= 6); },
  "gap0≥8 (partout)":       (rows, i) => { const o = gd(rows[i]); return o != null && !(o.gap0 >= 8); },
};
function run(exhGate) {
  const all = [];
  for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
    for (const s of (runMatrixBacktest(path.join(D, f), exhGate ? { exhGate } : {}).signals || []))
      if (typeof s.R === "number") all.push(s);
  return all;
}
function M(all) {
  const cont = all.filter((s) => s.type !== "EXHAUSTION"), exh = all.filter((s) => s.type === "EXHAUSTION");
  const sub = (a) => { const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return { n: a.length, wr: w / (w + l) || 0, avgR: R / a.length || 0, R, pf: gL ? gW / gL : Infinity }; };
  const sorted = all.slice().sort((a, b) => String(a.tsMT).localeCompare(String(b.tsMT)));
  let cum = 0, peak = 0, dd = 0; for (const s of sorted) { cum += s.R; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  return { tot: sub(all), cont: sub(cont), exh: sub(exh), dd };
}
const P = (m) => `n=${String(m.n).padStart(4)} WR ${(m.wr * 100).toFixed(1)}% avgR ${(m.avgR >= 0 ? "+" : "") + m.avgR.toFixed(3)} PF ${m.pf === Infinity ? "∞" : m.pf.toFixed(2)} R ${(m.R >= 0 ? "+" : "") + m.R.toFixed(1)}`;
const show = (name, all) => { const m = M(all); console.log(`\n${name}`); console.log(`  UNIVERS : ${P(m.tot)} · maxDD ${m.dd.toFixed(1)}`); console.log(`  CONT    : ${P(m.cont)}`); console.log(`  EXH     : ${P(m.exh)}`); };
show("BASELINE (218025c)", run(null));
for (const [name, fn] of Object.entries(V)) show(name, run(fn));
