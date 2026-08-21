import fs from "fs"; import path from "path";
const { runMatrixBacktest } = await import("../src/components/simulations/matrixBacktest.mjs");
const D = "C:/Users/Public/Neo-Backtest/data/matrix";
const rows = [];
for (const f of fs.readdirSync(D).filter(x => x.toLowerCase().endsWith(".csv")).sort())
  for (const s of (runMatrixBacktest(path.join(D, f)).signals || [])) if (typeof s.R === "number") rows.push(s);
const strong = rows.filter(s => s.profile === "Strong Bull" || s.profile === "Strong Bear");
const agg = r => { const w = r.filter(s => s.outcome === "WIN").length, l = r.filter(s => s.outcome === "LOSS").length, R = r.reduce((x, s) => x + s.R, 0); return { n: r.length, wr: (w + l) ? w / (w + l) * 100 : 0, R, avg: r.length ? R / r.length : 0 }; };
const fmt = a => `n ${String(a.n).padStart(4)} · WR ${a.wr.toFixed(1).padStart(5)}% · avgR ${(a.avg>=0?"+":"")+a.avg.toFixed(3)} · R ${(a.R>=0?"+":"")+a.R.toFixed(1)}`;
const P = (l, r) => console.log(`  ${l.padEnd(30)} ${fmt(agg(r))}`);
const isCon = s => s.obs?.contact === "CONTACT";
const isExt = s => s.obs?.dailyForce === "EXTREME";
const bad = s => isCon(s) || isExt(s);
console.log(`==== STRONG : gate qualité · cohorte n=${strong.length} ${fmt(agg(strong))} ====\n`);
P("CONTACT seul", strong.filter(isCon));
P("dailyForce EXTREME seul", strong.filter(isExt));
P("recouvrement (les deux)", strong.filter(s => isCon(s) && isExt(s)));
P("union (CONTACT ∪ EXTREME)", strong.filter(bad));
console.log("");
P("Strong GARDÉS (¬bad)", strong.filter(s => !bad(s)));
P("→ retiré CONTACT seul", strong.filter(s => !isCon(s)));
P("→ retiré EXTREME seul", strong.filter(s => !isExt(s)));
console.log("\n### robustesse de l'UNION retirée, par mois (R des trades COUPÉS) :");
const cut = strong.filter(bad);
const byM = {}; for (const s of cut) { const m = String(s.tsMT).slice(0, 7); (byM[m] ??= []).push(s); }
for (const m of Object.keys(byM).sort()) P(`  ${m} (coupé)`, byM[m]);
console.log("\n### robustesse par ACTIF (R des trades COUPÉS, doit être ≤0 partout) :");
const byA = {}; for (const s of cut) { const a = s._asset || "?"; }
