import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const all = [];
for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || []))
    if (typeof s.R === "number") all.push(s);

const agg = (rows) => {
  const w = rows.filter(s => s.outcome === "WIN").length, l = rows.filter(s => s.outcome === "LOSS").length;
  const R = rows.reduce((x, s) => x + s.R, 0);
  return { n: rows.length, wr: (w + l) ? w / (w + l) * 100 : 0, R, avg: rows.length ? R / rows.length : 0 };
};
const fmt = (a) => `n ${String(a.n).padStart(5)} · WR ${a.wr.toFixed(1).padStart(5)}% · avgR ${(a.avg>=0?"+":"")+a.avg.toFixed(3)} · totalR ${(a.R>=0?"+":"")+a.R.toFixed(1)}`;
const line = (label, rows) => rows.length ? console.log(`  ${label.padEnd(34)} ${fmt(agg(rows))}`) : null;

console.log(`\n======== WR PAR PROFIL — moteur live (âge-1 raffiné) · N=${all.length} ========`);
console.log(`\n### GLOBAL`);
line("TOUT", all);
for (const t of ["EXHAUSTION", "CONTINUATION"]) line(t, all.filter(s => s.type === t));

const profiles = [...new Set(all.map(s => s.profile).filter(Boolean))].sort();
for (const t of ["EXHAUSTION", "CONTINUATION"]) {
  console.log(`\n### ${t} — par profil`);
  const tr = all.filter(s => s.type === t);
  for (const p of profiles) { const r = tr.filter(s => s.profile === p); if (r.length) line(p, r); }
  console.log(`  ${"—".repeat(30)}`);
  line("↳ BUY", tr.filter(s => s.side === "BUY"));
  line("↳ SELL", tr.filter(s => s.side === "SELL"));
}

console.log(`\n### ${"EXHAUSTION"} — profil × side (détail)`);
const ex = all.filter(s => s.type === "EXHAUSTION");
for (const p of profiles) for (const sd of ["BUY", "SELL"]) { const r = ex.filter(s => s.profile === p && s.side === sd); if (r.length) line(`${p} / ${sd}`, r); }
