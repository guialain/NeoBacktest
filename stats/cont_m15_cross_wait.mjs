// RÈGLE OWNER 2026-07-21 : WAIT le CONT si cross M15 (fenêtre 4 bougies) ET K/D M15 contraire au trade.
//   BUY bloqué si K<D M15 · SELL bloqué si K>D M15. Le M15 PRÉCÈDE le H1 → attrape le retournement tôt.
import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const num = (v) => { const n = Number(v); return (v === "" || v == null || !Number.isFinite(n)) ? null : n; };
function m15(row) {
  const k = [0, 1, 2, 3].map((i) => num(row?.[`stoch_k_m15_s${i}`])), d = [0, 1, 2, 3].map((i) => num(row?.[`stoch_d_m15_s${i}`]));
  if (k.some((x) => x == null) || d.some((x) => x == null)) return null;
  const g = k.map((kk, i) => kk - d[i]);
  let crossAge = null; for (let i = 0; i < 3; i++) if (g[i] * g[i + 1] < 0) { crossAge = i; break; }
  return { g0: g[0], crossAge };   // crossAge 0-2 = cross dans la fenêtre ; g0 = K−D M15 courant
}
const contra = (o, side) => (side === "BUY" && o.g0 < 0) || (side === "SELL" && o.g0 > 0);
const V = {
  "cross(4b) + K/D contra (owner)": (o, side) => o.crossAge != null && contra(o, side),
  "cross FRAIS(0-1) + K/D contra":  (o, side) => o.crossAge != null && o.crossAge <= 1 && contra(o, side),
  "K/D contra SEUL (sans cross)":   (o, side) => contra(o, side),
};
// mesure : univers + DD, et la cohorte JETÉE (était-elle perdante ?)
function run(fn) {
  const kept = [], dropped = [];
  for (const f of fs.readdirSync(D).filter((x) => x.toLowerCase().endsWith(".csv")).sort()) {
    const drop = fn ? (rows, i, sel) => { const o = m15(rows[i]); const d = o != null && fn(o, sel.side); if (d) dropped.push({ R: 0 }); return d; } : null;
    // on capture le R des jetés en les laissant tirer une 2e fois SANS gate pour comparer — trop lourd ;
    // à la place : run avec gate (kept) ; le R jeté s'estime via run baseline − run gaté.
    for (const s of (runMatrixBacktest(path.join(D, f), drop ? { contGate: drop } : {}).signals || [])) if (typeof s.R === "number") kept.push(s);
  }
  return kept;
}
function M(all) { const sub = (a) => { const w = a.filter((s) => s.outcome === "WIN").length, l = a.filter((s) => s.outcome === "LOSS").length, R = a.reduce((x, s) => x + s.R, 0), gW = a.filter((s) => s.R > 0).reduce((x, s) => x + s.R, 0), gL = Math.abs(a.filter((s) => s.R < 0).reduce((x, s) => x + s.R, 0)); return { n: a.length, wr: w / (w + l) || 0, avgR: R / a.length || 0, R, pf: gL ? gW / gL : Infinity }; }; const sorted = all.slice().sort((a, b) => String(a.tsMT).localeCompare(String(b.tsMT))); let cum = 0, peak = 0, dd = 0; for (const s of sorted) { cum += s.R; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum); } return { m: sub(all), dd }; }
const P = (r) => `n=${String(r.m.n).padStart(4)} totalR ${(r.m.R >= 0 ? "+" : "") + r.m.R.toFixed(1)} avgR ${(r.m.avgR).toFixed(3)} PF ${r.m.pf === Infinity ? "∞" : r.m.pf.toFixed(2)} maxDD ${r.dd.toFixed(1)}`;
const base = run(null); const bm = M(base);
console.log("BASELINE :", P(bm), "\n");
for (const [name, fn] of Object.entries(V)) { const r = M(run(fn)); console.log(`${name.padEnd(34)} ${P(r)}   ΔR ${(r.m.R - bm.m.R >= 0 ? "+" : "") + (r.m.R - bm.m.R).toFixed(1)} · jetés ${bm.m.n - r.m.n} valaient ${((base.reduce((a, s) => a + s.R, 0) - run(fn).reduce((a, s) => a + s.R, 0))).toFixed(1)} R`); }
