// exh_filter_universe.mjs — EFFET UNIVERS des filtres EXH (owner : perf globale, métriques complètes + DD)
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
const div0Of = (row) => { const g0 = num(row?.stoch_k_h1_s0) != null && num(row?.stoch_d_h1_s0) != null ? Math.abs(num(row.stoch_k_h1_s0) - num(row.stoch_d_h1_s0)) : null; const g1 = num(row?.stoch_k_h1_s1) != null && num(row?.stoch_d_h1_s1) != null ? Math.abs(num(row.stoch_k_h1_s1) - num(row.stoch_d_h1_s1)) : null; return (g0 != null && g1 != null) ? g0 - g1 : null; };
const V = {
  "FRESH only (drop CONFIRMED)": (rows, i, sel, det) => det?.stoch?.perTf?.h1?.kd?.crossoverMaturity !== "FRESH",
  "drop age1 (garde 0 & 2)":     (rows, i, sel, det) => det?.stoch?.perTf?.h1?.kd?.crossAge === 1,
  "div0<0 only (la crème)":      (rows, i) => { const d = div0Of(rows[i]); return !(d != null && d < 0); },
};
function run(exhGate) {
  const all = [];
  for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort())
    for (const s of (runMatrixBacktest(path.join(D, f), exhGate ? { exhGate } : {}).signals || []))
      if (typeof s.R === "number") all.push(s);
  return all;
}
function metrics(all) {
  const cont = all.filter((s) => s.type !== "EXHAUSTION"), exh = all.filter((s) => s.type === "EXHAUSTION");
  const sub = (a) => { const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return { n: a.length, wr: w / (w + l) || 0, avgR: R / a.length || 0, R, pf: gL ? gW / gL : Infinity }; };
  // DD : trades triés par temps, courbe cumulée de R
  const sorted = all.slice().sort((a, b) => String(a.tsMT).localeCompare(String(b.tsMT)));
  let cum = 0, peak = 0, dd = 0;
  for (const s of sorted) { cum += s.R; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); }
  return { tot: sub(all), cont: sub(cont), exh: sub(exh), dd };
}
const P = (m) => `n=${String(m.n).padStart(4)} WR ${(m.wr * 100).toFixed(0).padStart(3)}% avgR ${(m.avgR >= 0 ? "+" : "") + m.avgR.toFixed(3)} PF ${m.pf === Infinity ? "∞" : m.pf.toFixed(2)} R ${(m.R >= 0 ? "+" : "") + m.R.toFixed(1)}`;
const show = (name, all) => { const m = metrics(all); console.log(`\n${name}`); console.log(`  UNIVERS : ${P(m.tot)} · maxDD ${m.dd.toFixed(1)} R`); console.log(`  CONT    : ${P(m.cont)}`); console.log(`  EXH     : ${P(m.exh)}`); };
show("BASELINE (aucun filtre EXH)", run(null));
for (const [name, fn] of Object.entries(V)) show(name, run(fn));
