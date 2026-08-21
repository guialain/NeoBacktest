import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const rows = [];
for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) if (typeof s.R === "number") rows.push(s);
const agg = r => { const w = r.filter(s => s.outcome === "WIN").length, l = r.filter(s => s.outcome === "LOSS").length, R = r.reduce((x, s) => x + s.R, 0); return { n: r.length, wr: (w + l) ? w / (w + l) * 100 : 0, R, avg: r.length ? R / r.length : 0 }; };
const fmt = a => `n ${String(a.n).padStart(4)} · WR ${a.wr.toFixed(1).padStart(5)}% · avgR ${(a.avg>=0?"+":"")+a.avg.toFixed(3)} · R ${(a.R>=0?"+":"")+a.R.toFixed(1)}`;
const isCon = s => s.obs?.contact === "CONTACT", isExt = s => s.obs?.dailyForce === "EXTREME";
const grp = (name, pool) => {
  console.log(`\n### ${name} (n=${pool.length})`);
  console.log(`  CONTACT :        dans ${fmt(agg(pool.filter(isCon)))}`);
  console.log(`                   hors ${fmt(agg(pool.filter(s => !isCon(s))))}`);
  console.log(`  dailyF EXTREME : dans ${fmt(agg(pool.filter(isExt)))}`);
  console.log(`                   hors ${fmt(agg(pool.filter(s => !isExt(s))))}`);
};
const cont = rows.filter(s => s.type === "CONTINUATION"), exh = rows.filter(s => s.type === "EXHAUSTION");
grp("SOFT (Soft Bull+Bear)", cont.filter(s => /^Soft/.test(s.profile)));
grp("STRONG (Strong Bull+Bear)", cont.filter(s => /^Strong/.test(s.profile)));
grp("TOUTE CONTINUATION", cont);
grp("EXHAUSTION", exh);
